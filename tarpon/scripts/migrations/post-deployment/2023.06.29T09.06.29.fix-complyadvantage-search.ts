import { round } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
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
    'request.fuzziness': { $exists: true },
    $where:
      'this.request.fuzziness !== this.response.rawComplyAdvantageResponse.content.data.filters.fuzziness',
  })
  for await (const item of cursor) {
    const fuzziness = round(item.request.fuzziness!, 1)
    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          'request.fuzziness': fuzziness,
          'response.rawComplyAdvantageResponse.content.data.filters.fuzziness':
            fuzziness,
        },
      }
    )
    logger.info(`Updated search ${item._id}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
