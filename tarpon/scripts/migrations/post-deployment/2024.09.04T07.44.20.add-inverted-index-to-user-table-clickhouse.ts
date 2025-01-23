import { migrateAllTenants } from '../utils/tenant'
import { envIsNot } from '@/utils/env'
import { Tenant } from '@/services/accounts/repository'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('dev') || envIsNot('local')) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const tableName = CLICKHOUSE_DEFINITIONS.USERS.tableName
  const query = `ALTER TABLE ${tableName} ADD INDEX inv_idx(username) TYPE full_text(0)`
  await client.query({ query })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
