import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { TransactionStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/transaction-stats'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }

  // manually refreshing all aggregated stats in mongodb to incorporate newly added fields
  await TransactionStatsDashboardMetric.refresh(tenant.id, {
    startTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 365, // 1 year ago
    endTimestamp: Date.now(),
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
