import { migrateAllTenants } from '../utils/tenant'
import { UserStats } from '@/services/analytics/dashboard-metrics/user-stats'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'pnb-uat' || tenant.id === 'pnb-stress') {
    // skip pnb-uat and pnb-stress
    return
  }
  await UserStats.refresh(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
