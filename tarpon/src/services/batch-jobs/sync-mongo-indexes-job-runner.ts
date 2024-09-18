import { BatchJobRunner } from './batch-job-runner-base'
import { SyncDatabasesBatchJob } from '@/@types/batch-job'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'
import { envIs } from '@/utils/env'

export class SyncDatabases extends BatchJobRunner {
  protected async run(job: SyncDatabasesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const teanantId = job.tenantId

    await createMongoDBCollections(mongoDb, teanantId)

    if (envIs('dev')) {
      await createTenantDatabase(teanantId)
    }
  }
}
