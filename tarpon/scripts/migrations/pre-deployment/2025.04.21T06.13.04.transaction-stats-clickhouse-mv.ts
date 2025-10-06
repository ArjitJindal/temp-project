import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
} from '@/utils/clickhouse/utils'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const tableName = CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
  const client = await getClickhouseClient(tenant.id)
  const transactionsClickHouseTable = ClickHouseTables.find(
    (t) => t.table === CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
  )
  if (!transactionsClickHouseTable) {
    throw new Error('Transactions table not found')
  }
  for (const view of transactionsClickHouseTable.materializedViews || []) {
    if (
      view.table === 'transactions_monthly_stats' ||
      view.table === 'transactions_daily_stats' ||
      view.table === 'transactions_hourly_stats'
    ) {
      await client.query({ query: `DROP VIEW IF EXISTS ${view.viewName}` })
      await client.query({ query: `DROP TABLE IF EXISTS ${view.table}` })
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, tableName)
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
