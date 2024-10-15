import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import { Tenant } from '@/services/accounts'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (
    (envIs('sandbox') && process.env.REGION === 'eu-1') ||
    envIs('sandbox:eu-1')
  ) {
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
