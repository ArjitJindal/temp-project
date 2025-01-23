import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const db = await getMongoDbClient()
  const table = ClickHouseTables.find(
    (table) => table.table === CLICKHOUSE_DEFINITIONS.REPORTS.tableName
  )
  if (!table) {
    return
  }
  await syncClickhouseTableWithMongo(db, tenant.id, table)
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
