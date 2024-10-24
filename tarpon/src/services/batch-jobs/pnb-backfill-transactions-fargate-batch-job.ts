import pMap from 'p-map'
import { compact } from 'lodash'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RulesEngineService } from '../rules-engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillTransactions } from '@/@types/batch-job'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { acquireInMemoryLocks } from '@/utils/lock'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { pickKnownEntityFields } from '@/utils/object'
export class PnbBackfillTransactionsBatchJobRunner extends BatchJobRunner {
  private rulesEngine!: RulesEngineService
  private progressKey!: string
  protected async run(job: PnbBackfillTransactions): Promise<void> {
    const { tenantId } = job
    const { startTimestamp, concurrency = 50 } = job.parameters
    const db = await getMongoDbClientDb()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.rulesEngine = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator
    )

    this.progressKey = `backfill-transactions-${tenantId}`
    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.progressKey)) ?? 0
    const cursor = db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        timestamp: { $gt: Math.max(lastCompletedTimestamp, startTimestamp) },
      })
      .sort({ timestamp: 1 })

    const start = Date.now()
    logger.warn('Starting to process transactions')

    let batchTransactions: InternalTransaction[] = []
    for await (const transaction of cursor) {
      batchTransactions.push(transaction)
      if (batchTransactions.length === 10000) {
        await this.processBatch(batchTransactions, concurrency)
        logger.warn(`Processed ${batchTransactions.length} transactions`)
        batchTransactions = []
      }
    }
    await this.processBatch(batchTransactions, concurrency)

    const duration = (Date.now() - start) / 1000
    logger.warn(`Finished processing transactions in ${duration}s`)
  }

  private async processBatch(
    batchTransactions: InternalTransaction[],
    concurrency: number
  ) {
    await pMap(
      batchTransactions,
      async (internalTransaction, index) => {
        const transaction = pickKnownEntityFields(
          internalTransaction,
          Transaction
        )
        const releaseLocks = await acquireInMemoryLocks(
          compact([transaction.originUserId, transaction.destinationUserId])
        )
        await this.rulesEngine.verifyTransaction(
          {
            ...transaction,
          },
          {
            validateTransactionId: false,
            validateDestinationUserId: false,
            validateOriginUserId: false,
          }
        )
        releaseLocks()
        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.progressKey,
            transaction.timestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
