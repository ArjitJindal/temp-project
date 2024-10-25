import pMap from 'p-map'
import { compact } from 'lodash'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillArs } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { acquireInMemoryLocks } from '@/utils/lock'

export class PnbBackfillArsBatchJobRunner extends BatchJobRunner {
  private progressKey!: string
  private riskScoringService!: RiskScoringV8Service

  protected async run(job: PnbBackfillArs): Promise<void> {
    const { tenantId } = job
    const { concurrency } = job.parameters

    const db = await getMongoDbClientDb()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.riskScoringService = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb: await getMongoDbClient(), dynamoDb }
    )

    this.progressKey = `backfill-ars-${tenantId}`
    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.progressKey)) ?? 0
    const cursor = db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({ timestamp: { $gte: lastCompletedTimestamp } })
      .sort({ timestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

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
  }

  private async processBatch(
    batchTransactions: InternalTransaction[],
    concurrency: number
  ) {
    await pMap(
      batchTransactions,
      async (transaction, index) => {
        const releaseLocks = await acquireInMemoryLocks(
          compact([transaction.originUserId, transaction.destinationUserId])
        )
        await this.riskScoringService.handleTransaction(
          transaction,
          [
            {
              transactionId: transaction.transactionId,
              timestamp: transaction.timestamp,
              transactionState: transaction.transactionState ?? 'CREATED',
              updatedTransactionAttributes: transaction,
            },
          ],
          // NOTE: no user entity variables being used in the transaction risk factors for PNB
          undefined,
          undefined
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
