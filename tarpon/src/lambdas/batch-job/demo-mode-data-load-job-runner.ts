import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { seedMongo } from '@/core/seed/mongo'

export class DemoModeDataLoadJobRunner extends BatchJobRunner {
  protected async run(job: DemoModeDataLoadBatchJob): Promise<any> {
    // Create collections
    const { tenantId } = job

    console.log('Generate collections names and S3 keys')
    const mongoDb = await getMongoDbClient()
    await seedMongo(mongoDb, tenantId)
  }
}
