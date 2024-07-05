import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { RuleHitsStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/rule-stats'

async function migrateTenant(tenant: Tenant) {
  await RuleHitsStatsDashboardMetric.refreshAlertsStats(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
