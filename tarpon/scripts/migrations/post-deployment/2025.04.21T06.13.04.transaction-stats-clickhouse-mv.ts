import { migrateAllTenants } from '../utils/tenant'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { Tenant } from '@/services/accounts/repository'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { RULE_ACTIONS } from '@/@types/openapi-internal-custom/RuleAction'
import { buildQueryPart } from '@/utils/clickhouse/queries/transaction-stats-clickhouse'

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
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, tableName)
      await client.query({ query: matQuery })

      const timeFormat =
        view.table === 'transactions_monthly_stats'
          ? 'toStartOfMonth(toDateTime(timestamp / 1000))'
          : view.table === 'transactions_daily_stats'
          ? 'toDate(toDateTime(timestamp / 1000))'
          : 'toStartOfHour(toDateTime(timestamp / 1000))'
      const backfillQuery = `
        INSERT INTO ${view.table} 
        SELECT 
            ${timeFormat} as time,
            ${buildQueryPart(
              PAYMENT_METHODS,
              'paymentMethods',
              'originPaymentMethod',
              'destinationPaymentMethod'
            )},
            ${buildQueryPart(RULE_ACTIONS, 'status', 'status')},
            ${buildQueryPart(RISK_LEVELS, 'arsRiskLevel', 'arsScore_riskLevel')}
        FROM ${tableName}
        WHERE toDateTime(timestamp / 1000) > toDateTime(0)
        GROUP BY time
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
