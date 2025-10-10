import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }

  const clickhouseClient = await getClickhouseClient(tenant.id)

  const dropViewQueries = [
    'DROP VIEW IF EXISTS alerts_investigation_stats_mv',
    'DROP VIEW IF EXISTS cases_investigation_stats_mv',
  ]

  const dropTableQueries = [
    'DROP TABLE IF EXISTS alerts_investigation_stats',
    'DROP TABLE IF EXISTS cases_investigation_stats',
  ]

  for (const query of dropViewQueries) {
    try {
      await clickhouseClient.exec({ query })
    } catch (error) {
      console.error(`Failed to execute query "${query}":`, error)
      throw error
    }
  }

  // Then drop tables
  for (const query of dropTableQueries) {
    try {
      await clickhouseClient.exec({ query })
    } catch (error) {
      console.error(`Failed to execute query "${query}":`, error)
      throw error
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
