import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const sanctionsSearchCollection = db.collection(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  await sanctionsSearchCollection.updateMany(
    {
      'response.rawComplyAdvantageResponse.content.data.id': { $exists: true },
    },
    [
      {
        $set: {
          'response.providerSearchId': {
            $toString: '$response.rawComplyAdvantageResponse.content.data.id', // Convert the id field to string
          },
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
