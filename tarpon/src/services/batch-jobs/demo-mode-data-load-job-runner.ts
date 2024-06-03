import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { seedMongo } from '@/core/seed/mongo'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { isDemoTenant } from '@/utils/tenant'
import { logger } from '@/core/logger'

@traceable
export class DemoModeDataLoadJobRunner extends BatchJobRunner {
  protected async run(job: DemoModeDataLoadBatchJob): Promise<void> {
    const { tenantId } = job
    if (!isDemoTenant(tenantId)) {
      logger.warn(`Tenant ${tenantId} is not a demo tenant`)
      return
    }
    const dynamo = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    await seedDynamo(dynamo, tenantId)
    await seedMongo(mongoDb, tenantId)
  }
}
