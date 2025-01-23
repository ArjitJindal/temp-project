import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const sanctionsSearchCollection = db.collection(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  await sanctionsSearchCollection.updateMany(
    { 'response.data': { $exists: false }, 'response.hitsCount': { $ne: 0 } },
    [
      {
        $set: {
          'response.data':
            '$response.rawComplyAdvantageResponse.content.data.hits',
        },
      },
    ]
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
