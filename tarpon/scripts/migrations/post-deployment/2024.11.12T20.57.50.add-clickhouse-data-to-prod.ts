import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import { envIs } from '@/utils/env'
import { Tenant } from '@/services/accounts'
import { ClickHouseTables } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (envIs('prod') && process.env.REGION === 'asia-1') {
    for (const table of ClickHouseTables) {
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
