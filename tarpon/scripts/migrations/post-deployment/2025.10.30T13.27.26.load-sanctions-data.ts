import { migrateAllTenants } from '../utils/tenant'
import { sendOpenSanctionsSanctionsDataFetch } from '../utils/trigger-sanctions-data-fetch'
import { isOpensearchAvailableInRegion } from '@/utils/opensearch-utils'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/@types/tenant'

let hasFeatureOpenSanctions = false

async function migrateTenant(_tenant: Tenant) {
  if (!isOpensearchAvailableInRegion()) {
    return
  }
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
