import pMap from 'p-map'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { Db } from 'mongodb'
import last from 'lodash/last'
import mean from 'lodash/mean'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillCra } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export class PnbBackfillCraBatchJobRunner extends BatchJobRunner {
  private dynamoDb!: DynamoDBClient
  private mongoDb!: Db
  private riskScoringService!: RiskScoringV8Service
  private riskRepository!: RiskRepository
  private tenantId!: string

  protected async run(job: PnbBackfillCra): Promise<void> {
    const { tenantId } = job
    const { concurrency, startTimestamp = 0 } = job.parameters

    this.tenantId = tenantId
    this.mongoDb = await getMongoDbClientDb()
    this.dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, this.dynamoDb)
    this.riskScoringService = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb: await getMongoDbClient(), dynamoDb: this.dynamoDb }
    )
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.jobId)) ?? 0
    const cursor = this.mongoDb
      .collection<InternalUser>(USERS_COLLECTION(tenantId))
      .find({
        createdTimestamp: {
          $gte: Math.max(lastCompletedTimestamp, startTimestamp),
        },
      })
      .sort({ createdTimestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

    let batchUsers: InternalUser[] = []
    for await (const user of cursor) {
      batchUsers.push(user)
      if (batchUsers.length === 10000) {
        await this.processBatch(batchUsers, concurrency)
        logger.warn(`Processed ${batchUsers.length} users`)
        batchUsers = []
      }
    }
    await this.processBatch(batchUsers, concurrency)
  }

  private async processBatch(batchUsers: InternalUser[], concurrency: number) {
    await pMap(
      batchUsers,
      async (user, index) => {
        // Calculate and update average ARS score
        const txCollection = this.mongoDb.collection<InternalTransaction>(
          TRANSACTIONS_COLLECTION(this.tenantId)
        )
        const transactionIds: string[] = (
          await txCollection
            .find({
              $or: [
                { originUserId: user.userId },
                { destinationUserId: user.userId },
              ],
            })
            .project({
              transactionId: 1,
            })
            .toArray()
        ).map((v) => v.transactionId)

        const arsScores = await this.riskScoringService.getArsScores(
          transactionIds
        )
        const avgArsScore =
          arsScores.length > 0
            ? mean(arsScores.map((v) => v.arsScore))
            : undefined
        if (avgArsScore) {
          await this.riskRepository.updateOrCreateAverageArsScore(user.userId, {
            userId: user.userId,
            value: avgArsScore,
            transactionCount: arsScores.length,
            createdAt: Date.now(),
          })
        }

        // Calculate and update CRA score
        const krsScore = await this.riskScoringService.getKrsScore(user.userId)
        const newDrsScore = this.riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          avgArsScore,
          krsScore: krsScore?.krsScore,
        })

        logger.debug(
          `[${user.userId}] KRS: ${user.krsScore?.krsScore}, ARS: ${avgArsScore} (${arsScores.length} txs), CRA: ${newDrsScore}`
        )

        await this.riskScoringService.updateDrsScore({
          userId: user.userId,
          drsScore: newDrsScore,
          transactionId: last(transactionIds) ?? 'FIRST_DRS',
          factorScoreDetails: last(arsScores)?.factorScoreDetails,
        })

        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.jobId,
            user.createdTimestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
