import { migrateAllTenants } from '../utils/tenant'
import { SanctionsService } from '@/services/sanctions'
import { Tenant } from '@/services/accounts'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import {
  SANCTIONS_SEARCHES_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'SANCTIONS'))) {
    return
  }
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  const cursor = collection.find({
    'request.fuzziness': { $lt: 0.1 },
    'response.rawComplyAdvantageResponse.content.data.filters.fuzziness': {
      $eq: 0.1,
    },
  })
  for await (const item of cursor) {
    const sanctionsService = new SanctionsService(tenant.id)
    const caSearchId =
      item.response?.rawComplyAdvantageResponse?.content?.data?.id
    if (caSearchId) {
      await sanctionsService.dangerousDeleteComplyAdvantageSearch(caSearchId)
    }
    await sanctionsService.search(item.request, { searchIdToReplace: item._id })
    logger.info(`Updated search ${item._id}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
