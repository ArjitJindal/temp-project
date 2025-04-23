import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

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
