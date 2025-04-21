import { migrateAllTenants } from '../utils/tenant'
import {
  ClickHouseTables,
  CLICKHOUSE_DEFINITIONS,
} from '@/utils/clickhouse/definition'
import {
  createMaterializedViewQuery,
  createMaterializedTableQuery,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const casesClickHouseTable = ClickHouseTables.find(
    (t) => t.table === CLICKHOUSE_DEFINITIONS.CASES.tableName
  )
  if (!casesClickHouseTable) {
    throw new Error('Cases table not found')
  }
  for (const view of casesClickHouseTable.materializedViews || []) {
    if (
      view.viewName ===
      CLICKHOUSE_DEFINITIONS.CASES.materializedViews
        .INVESTIGATION_TIMES_HOURLY_STATS.viewName
    ) {
      await client.query({ query: `DROP VIEW IF EXISTS ${view.viewName}` })
      await client.query({ query: `DROP TABLE IF EXISTS ${view.table}` })
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, view.table)
      await client.query({ query: matQuery })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
