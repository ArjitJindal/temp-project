import pMap from 'p-map'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { MongoClient } from 'mongodb'

import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillHammerhead } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import {
  arsScoreEventHandler,
  avgArsScoreEventHandler,
  drsScoreEventHandler,
  krsScoreEventHandler,
} from '@/lambdas/hammerhead-change-mongodb-consumer/app'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const BATCH_SIZE = 10000

export class PnbBackfillHammerheadBatchJobRunner extends BatchJobRunner {
  private dynamoDb!: DynamoDBClient
  private mongoDb!: MongoClient
  private tenantId!: string
  private riskRepository!: RiskRepository

  protected async run(job: PnbBackfillHammerhead): Promise<void> {
    const { tenantId, parameters } = job
    const { concurrency, type } = parameters

    this.tenantId = tenantId
    this.dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.jobId)) ?? 0

    if (type === 'USER') {
      const cursor = this.mongoDb
        .db()
        .collection<InternalUser>(USERS_COLLECTION(tenantId))
        .find({
          createdTimestamp: {
            $gte: Math.max(lastCompletedTimestamp, 0),
          },
        })
        .sort({ createdTimestamp: 1 })
        .addCursorFlag('noCursorTimeout', true)

      let batchUsers: InternalUser[] = []
      for await (const user of cursor) {
        batchUsers.push(user)
        if (batchUsers.length === BATCH_SIZE) {
          await this.processUserBatch(batchUsers, concurrency)
          logger.warn(`Processed ${batchUsers.length} users`)
          batchUsers = []
        }
      }
      await this.processUserBatch(batchUsers, concurrency)
    } else {
      const cursor = this.mongoDb
        .db()
        .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
        .find({
          timestamp: {
            $gte: Math.max(lastCompletedTimestamp, 0),
          },
        })
        .sort({ timestamp: 1 })
        .addCursorFlag('noCursorTimeout', true)

      let batchTransactions: InternalTransaction[] = []
      for await (const transaction of cursor) {
        batchTransactions.push(transaction)
        if (batchTransactions.length === BATCH_SIZE) {
          await this.processTransactionBatch(batchTransactions, concurrency)
          logger.warn(`Processed ${batchTransactions.length} transactions`)
          batchTransactions = []
        }
      }
      await this.processTransactionBatch(batchTransactions, concurrency)
    }
  }

  private async processTransactionBatch(
    transactions: InternalTransaction[],
    concurrency: number
  ) {
    await pMap(
      transactions,
      async (transaction) => {
        const arsScore = await this.riskRepository.getArsScore(
          transaction.transactionId
        )
        if (
          arsScore &&
          arsScore?.createdAt !== transaction.arsScore?.createdAt
        ) {
          await arsScoreEventHandler(this.tenantId, arsScore, {
            mongoDb: this.mongoDb,
            dynamoDb: this.dynamoDb,
          })
        }
      },
      { concurrency }
    )
    await updateMigrationLastCompletedTimestamp(
      this.jobId,
      transactions[transactions.length - 1].timestamp
    )
  }

  private async processUserBatch(
    batchUsers: InternalUser[],
    concurrency: number
  ) {
    await pMap(
      batchUsers,
      async (user) => {
        const [krsScore, drsScore, avgArsScore] = await Promise.all([
          this.riskRepository.getKrsScore(user.userId),
          this.riskRepository.getDrsScore(user.userId),
          this.riskRepository.getAverageArsScore(user.userId),
        ])
        await Promise.all(
          [
            krsScore && user.krsScore?.createdAt !== krsScore?.createdAt
              ? krsScoreEventHandler(this.tenantId, krsScore, {
                  mongoDb: this.mongoDb,
                  dynamoDb: this.dynamoDb,
                })
              : null,
            drsScore && user.drsScore?.createdAt !== drsScore?.createdAt
              ? drsScoreEventHandler(this.tenantId, undefined, drsScore, {
                  mongoDb: this.mongoDb,
                  dynamoDb: this.dynamoDb,
                })
              : null,
            avgArsScore &&
            user.avgArsScore?.createdAt !== avgArsScore?.createdAt
              ? avgArsScoreEventHandler(this.tenantId, avgArsScore, {
                  mongoDb: this.mongoDb,
                  dynamoDb: this.dynamoDb,
                })
              : null,
          ].filter(Boolean)
        )
      },
      {
        concurrency,
      }
    )
    await updateMigrationLastCompletedTimestamp(
      this.jobId,
      batchUsers[batchUsers.length - 1].createdTimestamp
    )
  }
}
