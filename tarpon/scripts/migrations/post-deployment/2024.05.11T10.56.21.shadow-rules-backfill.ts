import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { ShadowRuleStatsAnalytics } from '@/services/analytics/rules/shadow-rule-stats'

async function migrateTenant(tenant: Tenant) {
  await ShadowRuleStatsAnalytics.refresh(tenant.id, {
    startTimestamp: 1714215463000,
    endTimestamp: Date.now(),
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
