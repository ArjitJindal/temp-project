import { migrateAllTenants } from '../utils/tenant'
import { sendAcurisSanctionsDataFetch } from '../utils/trigger-sanctions-data-fetch'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/@types/tenant'

let hasFeatureAcuris = false
async function migrateTenant(_tenant: Tenant) {
  if (hasFeature('ACURIS')) {
    hasFeatureAcuris = true
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  if (hasFeatureAcuris) {
    await sendAcurisSanctionsDataFetch()
  }
}
export const down = async () => {
  // skip
}
