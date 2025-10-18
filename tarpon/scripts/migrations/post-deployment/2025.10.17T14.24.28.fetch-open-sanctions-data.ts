import { migrateAllTenants } from '../utils/tenant'
import {
  sendOpenSanctionsSanctionsDataFetch,
  sendTenantSpecificSanctionsDataFetch,
} from '../utils/trigger-sanctions-data-fetch'
import { isOpensearchAvailableInRegion } from '@/utils/opensearch-utils'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/@types/tenant'

let hasFeatureOpenSanctions = false

async function migrateTenant(tenant: Tenant) {
  if (!isOpensearchAvailableInRegion()) {
    return
  }
  await sendTenantSpecificSanctionsDataFetch(tenant.id)
  if (hasFeature('OPEN_SANCTIONS')) {
    hasFeatureOpenSanctions = true
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)

  if (hasFeatureOpenSanctions) {
    await sendOpenSanctionsSanctionsDataFetch()
  }
}
export const down = async () => {
  // skip
}
