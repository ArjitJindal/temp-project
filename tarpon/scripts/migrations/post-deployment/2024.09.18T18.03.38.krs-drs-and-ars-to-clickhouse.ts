import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { Tenant } from '@/services/accounts'
import { envIsNot } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('dev') || envIsNot('local')) {
    return
  }

  const tables = [
    CLICKHOUSE_DEFINITIONS.KRS_SCORE.tableName,
    CLICKHOUSE_DEFINITIONS.DRS_SCORE.tableName,
    CLICKHOUSE_DEFINITIONS.ARS_SCORE.tableName,
  ]

  for (const table of ClickHouseTables) {
    if (tables.includes(table.table)) {
      await syncClickhouseTableWithMongo(tenant.id, table)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
