import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getClickhouseClient } from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  const client = await getClickhouseClient(tenant.id)
  const dropMatColumn = `ALTER TABLE ${CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName} DROP COLUMN createdAt`
  await client.exec({ query: dropMatColumn })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
