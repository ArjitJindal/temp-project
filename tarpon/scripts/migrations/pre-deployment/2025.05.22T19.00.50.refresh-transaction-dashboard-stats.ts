import { migrateAllTenants } from '../utils/tenant'
import { TransactionStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/transaction-stats'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  // manually refreshing all aggregated stats in mongodb to incorporate newly added fields
  await TransactionStatsDashboardMetric.refresh(tenant.id, {
    startTimestamp: 0,
    endTimestamp: Date.now(),
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
