import { BatchJobRunner } from './batch-job-runner-base'
import { SyncIndexesBatchJob } from '@/@types/batch-job'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

export class SyncMongoDbIndexesBatchJobRunner extends BatchJobRunner {
  protected async run(job: SyncIndexesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const teanantId = job.tenantId

    await createMongoDBCollections(mongoDb, teanantId)
  }
}
