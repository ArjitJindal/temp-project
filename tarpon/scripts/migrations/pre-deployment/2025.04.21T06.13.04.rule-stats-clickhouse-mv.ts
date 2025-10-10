import { migrateAllTenants } from '../utils/tenant'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
} from '@/utils/clickhouse/utils'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { Tenant } from '@/@types/tenant'
async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const transactionTable = CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
  const transactionsClickHouseTable = ClickHouseTables.find(
    (t) => t.table === transactionTable
  )
  if (!transactionsClickHouseTable) {
    console.log(
      `ClickHouse table definition not found for table: ${transactionTable}`
    )
    return
  }
  for (const view of transactionsClickHouseTable.materializedViews || []) {
    if (
      view.viewName ===
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.RULE_STATS_HOURLY
        .viewName
    ) {
      await client.query({ query: `DROP VIEW IF EXISTS ${view.viewName}` })
      await client.query({ query: `DROP TABLE IF EXISTS ${view.table}` })
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, transactionTable)
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
