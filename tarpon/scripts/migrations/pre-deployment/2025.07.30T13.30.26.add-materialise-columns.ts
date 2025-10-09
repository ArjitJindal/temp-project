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
  const materializeQueries = [
    `ALTER table transactions MATERIALIZE COLUMN updateCount`,
    `ALTER table transactions MATERIALIZE COLUMN createdAt`,
    `ALTER table transactions MATERIALIZE COLUMN updatedAt`,
  ]
  for (const query of materializeQueries) {
    try {
      console.log(`Executing MATERIALIZE query for tenant ${tenant.id}`)
      await clickhouseClient.exec({ query })
      console.log(
        `Successfully executed MATERIALIZE query for tenant ${tenant.id}`
      )
    } catch (error) {
      console.error(
        `Failed to execute MATERIALIZE query "${query}" for tenant ${tenant.id}:`,
        error
      )
      throw error
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
