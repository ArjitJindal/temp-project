import { migrateAllTenants } from '../utils/tenant'
import {
  createOrUpdateClickHouseTable,
  getClickhouseClient,
  sanitizeTableName,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { envIsNot } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('local') && envIsNot('dev')) {
    return
  }
  const clickhouseClient = await getClickhouseClient()
  // drop tables
  for await (const table of ClickHouseTables) {
    const clickhouseTable = sanitizeTableName(`${tenant.id}-${table.table}`)
    const checkTableQuery = `DROP TABLE IF EXISTS ${clickhouseTable}`
    await clickhouseClient.query({ query: checkTableQuery })
    for await (const matView of table.materializedViews ?? []) {
      const checkMatViewQuery = `DROP VIEW IF EXISTS ${sanitizeTableName(
        `${tenant.id}-${matView.viewName}`
      )}`
      const dropMatViewTableQuery = `DROP TABLE IF EXISTS ${sanitizeTableName(
        `${tenant.id}-${matView.table}`
      )}`
      await clickhouseClient.query({ query: checkMatViewQuery })
      await clickhouseClient.query({ query: dropMatViewTableQuery })
    }

    // create tables
    await createOrUpdateClickHouseTable(tenant.id, table)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
