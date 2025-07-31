import { BatchJobRunner } from './batch-job-runner-base'
import { SyncDatabasesBatchJob } from '@/@types/batch-job'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import {
  createTenantDatabase,
  isClickhouseEnabledInRegion,
  syncThunderSchemaTables,
} from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class SyncDatabases extends BatchJobRunner {
  protected async run(job: SyncDatabasesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const tenantId = job.tenantId

    await createMongoDBCollections(mongoDb, dynamoDb, tenantId)

    if (isClickhouseEnabledInRegion()) {
      await createTenantDatabase(tenantId)
      await syncThunderSchemaTables(tenantId)
    }
  }
}
