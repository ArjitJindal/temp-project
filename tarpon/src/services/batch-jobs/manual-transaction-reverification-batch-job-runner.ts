import { last } from 'lodash'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { RulesEngineService } from '../rules-engine'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { ManualTransactionReverification } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { TransientRepository } from '@/core/repositories/transient-repository'

const PARTITION_KEY = 'manual-re-verify-transactions'
type Progress = {
  timestamp: number
  transactionCount: number
}

export class ManualTransactionReverificationBatchJobRunner extends BatchJobRunner {
  private transactionsRepository!: MongoDbTransactionRepository
  private rulesEngineService!: RulesEngineService
  private concurrency!: number
  private mongoBatchSize!: number
  private transientRepository!: TransientRepository<Progress>
  private progressKey!: string
  protected async run(job: ManualTransactionReverification) {
    const { tenantId, parameters } = job
    const { timeRange, concurrency, mongoBatchSize, uniqId } = parameters
    this.concurrency = concurrency
    this.mongoBatchSize = mongoBatchSize
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    this.transactionsRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )
    this.transientRepository = new TransientRepository<Progress>(dynamoDb)
    this.progressKey = `${tenantId}-${uniqId}`
    const progress = await this.transientRepository.get(
      PARTITION_KEY,
      this.progressKey
    )
    await this.main(
      {
        startTime: progress?.timestamp ?? timeRange?.startTime ?? 0,
        endTime: timeRange?.endTime ?? Number.MAX_SAFE_INTEGER,
      },
      progress
    )
  }

  private async main(
    timeRange: { startTime: number; endTime: number },
    currentProgress?: Progress
  ) {
    let processedCount = currentProgress?.transactionCount ?? 0
    const transactionsCursor = this.transactionsRepository
      .getTransactionsCursor({
        afterTimestamp: timeRange?.startTime,
        beforeTimestamp: timeRange?.endTime,
        sortField: 'timestamp',
      })
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
    logger.info('Completed verifying all required transactions')
  }
}
