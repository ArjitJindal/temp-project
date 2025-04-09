import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const tableName = CLICKHOUSE_DEFINITIONS.USERS.tableName
  const usersClickHouseTable = ClickHouseTables.find(
    (t) => t.table === tableName
  )
  if (!usersClickHouseTable) {
    console.log(`ClickHouse table definition not found for table: ${tableName}`)
    return
  }
  for (const table of usersClickHouseTable?.materializedViews || []) {
    if (
      table.table === 'user_monthly_stats' ||
      table.table === 'user_daily_stats' ||
      table.table === 'user_hourly_stats'
    ) {
      await client.query({
        query: createMaterializedTableQuery(table),
      })
      await client.query({
        query: await createMaterializedViewQuery(table, tableName, tenant.id),
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
