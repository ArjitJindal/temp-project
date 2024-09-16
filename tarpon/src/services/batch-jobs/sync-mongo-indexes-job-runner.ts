import { BatchJobRunner } from './batch-job-runner-base'
import { SyncDatabasesBatchJob } from '@/@types/batch-job'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'

export class SyncDatabases extends BatchJobRunner {
  protected async run(job: SyncDatabasesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const teanantId = job.tenantId

    await createMongoDBCollections(mongoDb, teanantId)
    await createTenantDatabase(teanantId)
  }
}
