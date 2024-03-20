import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts'
import { TransactionStatsDashboardMetric } from '@/lambdas/console-api-dashboard/repositories/dashboard-metrics/transaction-stats'

async function migrateTenant(tenant: Tenant) {
  if (await tenantHasFeature(tenant.id, 'RISK_SCORING')) {
    await TransactionStatsDashboardMetric.refresh(tenant.id)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
