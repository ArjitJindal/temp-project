import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { TestFargateJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export class TestFargateBatchJobRunner extends BatchJobRunner {
  protected async run(job: TestFargateJob): Promise<void> {
    const { message } = job.parameters
    logger.info(`TestFargateBatchJobRunner: ${message}`)
    const dynamoDb = getDynamoDbClient()

    // Test DynamoDB connection
    const tenantRepository = new TenantRepository(job.tenantId, { dynamoDb })
    const tenant = await tenantRepository.getTenantSettings()
    logger.info(`Tenant: ${JSON.stringify(tenant)}`)

    // Test MongoDB connection
    const mongoDb = await getMongoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      job.tenantId,
      mongoDb
    )

    const transactions = await transactionRepository.getAllTransactionsCount()
    logger.info(`All transactions count: ${transactions}`)
  }
}
