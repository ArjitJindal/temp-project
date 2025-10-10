import { migrateAllTenants } from '../utils/tenant'
import { sendTenantSpecificSanctionsDataFetch } from '../utils/trigger-sanctions-data-fetch'
import { Tenant } from '@/@types/tenant'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('DOW_JONES')) {
    await sendTenantSpecificSanctionsDataFetch(tenant.id)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
