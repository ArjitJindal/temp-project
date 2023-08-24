import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { seedMongo } from '@/core/seed/mongo'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class DemoModeDataLoadJobRunner extends BatchJobRunner {
  protected async run(job: DemoModeDataLoadBatchJob): Promise<any> {
    // Create collections
    const { tenantId } = job

    console.log('Generate collections names and S3 keys')
    const dynamo = await getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    await seedDynamo(dynamo, tenantId)
    await seedMongo(mongoDb, tenantId)
  }
}
