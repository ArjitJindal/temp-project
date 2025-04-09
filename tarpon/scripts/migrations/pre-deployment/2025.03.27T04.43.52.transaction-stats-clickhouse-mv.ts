import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
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
