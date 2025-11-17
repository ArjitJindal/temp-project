import { migrateAllTenants } from '../utils/tenant'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { Tenant } from '@/@types/tenant'

async function migrateTenant(tenant: Tenant) {
  const clickhouseClient = await getClickhouseClient(tenant.id)
  const tablesToDelete = [
    'cases_investigation_times_hourly',
    'transactions_monthly_stats',
    'transactions_daily_stats',
    'transactions_hourly_stats',
    'rule_stats_hourly_transactions',
    'user_monthly_stats',
    'user_daily_stats',
    'user_hourly_stats',
  ]
  const viewsToDelete = [
    'cases_investigation_times_hourly_mv',
    'transactions_monthly_stats_mv',
    'transactions_daily_stats_mv',
    'transactions_hourly_stats_mv',
    'rule_stats_hourly_transactions_mv',
    'user_monthly_stats_mv',
    'user_daily_stats_mv',
    'user_hourly_stats_mv',
  ]
  for (const view of viewsToDelete) {
    await clickhouseClient.exec({ query: `DROP VIEW IF EXISTS ${view}` })
  }
  for (const table of tablesToDelete) {
    await clickhouseClient.exec({ query: `DROP TABLE IF EXISTS ${table}` })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
