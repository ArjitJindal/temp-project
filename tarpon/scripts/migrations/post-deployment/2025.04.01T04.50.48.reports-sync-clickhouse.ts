import { backOff } from 'exponential-backoff'
import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'
import {
  createOrUpdateClickHouseTable,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const clikckHouseClient = await getClickhouseClient(tenant.id)
  await clikckHouseClient.query({ query: 'DROP TABLE IF EXISTS reports' })
  for (const table of ClickHouseTables) {
    if (table.table === 'reports') {
      await createOrUpdateClickHouseTable(tenant.id, table)
      await backOff(
        () =>
          syncClickhouseTableWithMongo(mongoClient, dynamoDb, tenant.id, table),
        {
          numOfAttempts: 3,
          maxDelay: 10000,
          timeMultiple: 2,
          jitter: 'full',
          retry(e: Error, attemptNumber: number) {
            logger.error(
              `Failed attempt ${attemptNumber} for table ${table.table}:`,
              e
            )
            return attemptNumber <= 3
          },
        }
      )

      logger.info(
        `Completed sync for table ${table.table} - Tenant: ${tenant.id}`
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
