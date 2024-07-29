import { migrateAllTenants } from '../utils/tenant'
import { bumpRuleAggregationVariablesVersion } from '../utils/rule'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  await bumpRuleAggregationVariablesVersion(tenant.id, (v) =>
    JSON.stringify(v.filtersLogic)?.includes('TRANSACTION_EVENT')
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
