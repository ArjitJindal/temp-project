import { migrateAllTenants } from '../utils/tenant'
import {
  ClickHouseTables,
  CLICKHOUSE_DEFINITIONS,
} from '@/utils/clickhouse/definition'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'
async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
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
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, transactionTable)
      await client.query({ query: matQuery })
      const backfillQuery = `
      INSERT INTO ${view.table}
      SELECT
        toStartOfHour(toDateTime(timestamp / 1000)) as time,
        arrayJoin(nonShadowHitRuleIdPairs).1 AS ruleInstanceId,
        arrayJoin(nonShadowHitRuleIdPairs).2 AS ruleId
      FROM ${transactionTable}
      `
      await client.query({ query: backfillQuery })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
