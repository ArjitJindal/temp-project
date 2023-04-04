import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { copyCollections } from '@/utils/seed'

const FLAGRIGHT = 'flagright'

export class DemoModeDataLoadJobRunner implements BatchJobRunner {
  public async run(job: DemoModeDataLoadBatchJob) {
    // Create collections
    const { tenantId } = job
    const mongoClient = await getMongoDbClient()

    console.log('Generate collections names and S3 keys')
    const db = mongoClient.db()

    await copyCollections(mongoClient, FLAGRIGHT, db, tenantId, db)
    await mongoClient.close()
  }
}
