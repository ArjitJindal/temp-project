import { BatchJobRunner } from './batch-job-runner-base'
import { sendBatchJobCommand } from './batch-job'
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
import { getFullTenantId } from '@/utils/tenant-id'
import { envIsNot } from '@/utils/env'

export class SyncDatabases extends BatchJobRunner {
  protected async run(job: SyncDatabasesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const tenantId = job.tenantId
    const testTenantId = getFullTenantId(job.tenantId, true)

    await createMongoDBCollections(mongoDb, dynamoDb, tenantId)
    await createMongoDBCollections(mongoDb, dynamoDb, testTenantId)

    if (isClickhouseEnabledInRegion()) {
      await createTenantDatabase(tenantId)
      await syncThunderSchemaTables(tenantId)
      await createTenantDatabase(testTenantId)
      await syncThunderSchemaTables(testTenantId)
    }

    if (envIsNot('prod')) {
      await sendBatchJobCommand({
        type: 'DEMO_MODE_DATA_LOAD',
        tenantId: testTenantId,
      })
    }
  }
}
