import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const dropMatColumn = `ALTER TABLE ${CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName} DROP COLUMN IF EXISTS createdAt`
  await client.exec({ query: dropMatColumn })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
