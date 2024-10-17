import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { Tenant } from '@/services/accounts'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('sandbox') && !envIs('dev') && !envIs('local')) {
    return
  }

  const table = ClickHouseTables.find(
    (table) =>
      table.table ===
      CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName
  )

  if (!table) {
    return
  }

  await syncClickhouseTableWithMongo(tenant.id, table)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
