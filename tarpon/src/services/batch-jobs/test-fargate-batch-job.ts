import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { TestFargateJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { tenantSettings } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class TestFargateBatchJobRunner extends BatchJobRunner {
  protected async run(job: TestFargateJob): Promise<void> {
    const { message } = job.parameters
    logger.info(`TestFargateBatchJobRunner: ${message}`)

    // Test DynamoDB connection
    const tenant = await tenantSettings(job.tenantId)
    logger.info(`Tenant: ${JSON.stringify(tenant)}`)

    // Test MongoDB connection
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      job.tenantId,
      mongoDb,
      dynamoDb
    )

    const transactions = await transactionRepository.getAllTransactionsCount()
    logger.info(`All transactions count: ${transactions}`)
  }
}
