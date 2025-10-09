import { migrateAllTenants } from '../utils/tenant'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { Tenant } from '@/@types/tenant'
import { isDemoTenant } from '@/utils/tenant-id'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  if (isDemoTenant(tenant.id)) {
    return
  }
  const clickhouseClient = await getClickhouseClient(tenant.id)
  try {
    await clickhouseClient.exec({
      query: `ALTER table users MATERIALIZE COLUMN linkedEntities_parentUserId`,
    })
  } catch (error) {
    console.error(
      `Failed to execute MATERIALIZE query for tenant ${tenant.id}:`,
      error
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
