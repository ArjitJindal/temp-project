import { cleanupRuleHits } from '../utils/cleanup-rule-hits'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }
  const timeRange = { start: 1693833998552, end: 1694624623835 } // start: 3:26:38 PM Sep 4, 2023
  await cleanupRuleHits({
    ruleInstanceId: 'd9487625',
    tenantId: 'QEO03JYKBT',
    impactTimestamps: timeRange,
    migrationKey: '2023.09.13T15.44.58.fix-kevin-rule-hits-1',
  })
  await cleanupRuleHits({
    ruleInstanceId: '51178859',
    tenantId: 'QEO03JYKBT',
    impactTimestamps: timeRange,
    migrationKey: '2023.09.13T15.44.58.fix-kevin-rule-hits-2',
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
