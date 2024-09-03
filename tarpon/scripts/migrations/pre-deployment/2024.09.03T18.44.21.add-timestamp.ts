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
      '$response.rawComplyAdvantageResponse.content.data.created_at': {
        $exists: true,
      },
    }, // Match documents that have the string timestamp field
    [
      {
        $set: {
          epochTimestamp: {
            $toLong: {
              $dateToParts: {
                date: {
                  $dateFromString: {
                    dateString:
                      '$response.rawComplyAdvantageResponse.content.data.created_at',
                    format: '%Y-%m-%d %H:%M:%S',
                  },
                },
              },
            },
          },
        },
      },
      {
        $set: {
          epochTimestamp: {
            $add: [
              { $multiply: ['$response.createdAt', 1000] }, // Convert seconds to milliseconds
              { $subtract: [0, { $mod: ['$response.createdAt', 1000] }] }, // Handle milliseconds
            ],
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
