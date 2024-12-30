import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  isClickhouseEnabledInRegion,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }

  const client = await getClickhouseClient(tenant.id)
  await client.query({
    query: `ALTER TABLE cases MATERIALIZE COLUMN alerts`,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
