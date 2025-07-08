import { JsonMigrationService } from 'thunder-schema'
import { BatchJobRunner } from './batch-job-runner-base'
import { SyncDatabasesBatchJob } from '@/@types/batch-job'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import {
  createTenantDatabase,
  getClickhouseCredentials,
  getClickhouseDefaultCredentials,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { MigrationTrackerTable } from '@/models/migration-tracker'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class SyncDatabases extends BatchJobRunner {
  protected async run(job: SyncDatabasesBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const teanantId = job.tenantId

    await createMongoDBCollections(mongoDb, dynamoDb, teanantId)

    if (isClickhouseEnabledInRegion()) {
      await createTenantDatabase(teanantId)
    }

    const defaultConfig = await getClickhouseDefaultCredentials()
    const clickhouseCredentials = await getClickhouseCredentials(teanantId)
    const jsonMigrationService = new JsonMigrationService(clickhouseCredentials)
    const migrationTracker = new MigrationTrackerTable({
      credentials: defaultConfig,
    }).objects

    for await (const migration of migrationTracker) {
      const fileName = migration.id
      const migrationData = JSON.parse(migration.data)
      await jsonMigrationService.migrate(`${fileName}.ts`, migrationData)
    }
  }
}
