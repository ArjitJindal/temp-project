import { migrateAllTenants } from '../utils/tenant'
import {
  createTenantDatabase,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'

export async function syncClickhouseTables() {
  if (isClickhouseEnabledInRegion()) {
    await migrateAllTenants(async (tenant) => {
      await createTenantDatabase(tenant.id)
    })
  }
}
