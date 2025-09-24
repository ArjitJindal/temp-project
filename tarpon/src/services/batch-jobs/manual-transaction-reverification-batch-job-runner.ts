import last from 'lodash/last'
import { MongoClient } from 'mongodb'
import { RulesEngineService } from '../rules-engine'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { ManualTransactionReverification } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { TransientRepository } from '@/core/repositories/transient-repository'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const PARTITION_KEY = 'manual-re-verify-transactions'
type Progress = {
  timestamp: number
  transactionCount: number
}

export class ManualTransactionReverificationBatchJobRunner extends BatchJobRunner {
  private mongoDb!: MongoClient
  private rulesEngineService!: RulesEngineService
  private concurrency!: number
  private mongoBatchSize!: number
  private transientRepository!: TransientRepository<Progress>
  private progressKey!: string
  private tenantId!: string
  protected async run(job: ManualTransactionReverification) {
    const { tenantId, parameters } = job
    this.tenantId = tenantId
    const { timeRange, concurrency, mongoBatchSize, uniqId } = parameters
    this.concurrency = concurrency
    this.mongoBatchSize = mongoBatchSize
    const dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      this.mongoDb
    )
    this.transientRepository = new TransientRepository<Progress>(dynamoDb)
    this.progressKey = `${tenantId}-${uniqId}`
    const progress = await this.transientRepository.get(
      PARTITION_KEY,
      this.progressKey
    )
    await this.reverifyTransactions(
      {
        startTime: progress?.timestamp ?? timeRange?.startTime ?? 0,
        endTime: timeRange?.endTime ?? Number.MAX_SAFE_INTEGER,
      },
      progress
    )
  }

  private async reverifyTransactions(
    timeRange: { startTime: number; endTime: number },
    currentProgress?: Progress
  ) {
    logger.info('Reverifying transactions')
    let processedCount = currentProgress?.transactionCount ?? 0
    const transactionsCursor = this.mongoDb
      .db()
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(this.tenantId))
      .find({
        timestamp: { $gte: timeRange.startTime, $lte: timeRange.endTime },
      })
      .sort({ timestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

    await processCursorInBatch(
      transactionsCursor,
      async (transactions) => {
        await Promise.all(
          transactions.map(async (transaction) => {
            await this.rulesEngineService.reverifyTransaction(transaction)
          })
        )
        processedCount += this.concurrency
        await this.transientRepository.add(PARTITION_KEY, this.progressKey, {
          timestamp: last(transactions)?.timestamp ?? timeRange.startTime,
          transactionCount: processedCount,
        })
        logger.info(`Processed ${processedCount} transactions`)
      },
      {
        processBatchSize: this.concurrency,
        mongoBatchSize: this.mongoBatchSize,
      }
    )
    await transactionsCursor.close()
    logger.info('Completed verifying all required transactions')
  }
}
