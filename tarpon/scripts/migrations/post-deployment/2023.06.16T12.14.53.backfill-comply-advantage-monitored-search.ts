import { migrateAllTenants } from '../utils/tenant'
import { SanctionsService } from '@/services/sanctions'
import { Tenant } from '@/services/accounts'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'SANCTIONS'))) {
    return
  }
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  for await (const item of collection.find({})) {
    const sanctionsService = new SanctionsService(tenant.id)
    const isMonitored = item.request.monitoring?.enabled
    const caSearchId =
      item.response?.rawComplyAdvantageResponse?.content?.data?.id
    if (isMonitored && caSearchId) {
      await sanctionsService.updateMonitoredSearch(caSearchId)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
