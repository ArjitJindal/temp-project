import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
    return
  }
  const clikckHouseClient = await getClickhouseClient(tenant.id)
  const alertsTable = CLICKHOUSE_DEFINITIONS.ALERTS.tableName
  await clikckHouseClient.query({
    query: `OPTIMIZE TABLE ${alertsTable} FINAL`,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
