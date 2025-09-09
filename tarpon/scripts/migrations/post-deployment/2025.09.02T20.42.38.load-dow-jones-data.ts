import { migrateAllTenants } from '../utils/tenant'
import { sendTenantSpecificSanctionsDataFetch } from '../utils/trigger-sanctions-data-fetch'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  await sendTenantSpecificSanctionsDataFetch(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
