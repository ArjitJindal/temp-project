import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { seedMongo } from '@/core/seed/mongo'

export class DemoModeDataLoadJobRunner implements BatchJobRunner {
  public async run(job: DemoModeDataLoadBatchJob) {
    // Create collections
    const { tenantId } = job
    const mongoClient = await getMongoDbClient()

    console.log('Generate collections names and S3 keys')
    const mongoDb = await getMongoDbClient()

    await seedMongo(mongoDb, tenantId)
    await mongoClient.close()
  }
}
