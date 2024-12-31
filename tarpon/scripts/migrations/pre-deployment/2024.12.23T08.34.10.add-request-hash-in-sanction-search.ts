import { omit } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { generateChecksum, getSortedObject } from '@/utils/object'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const searchesCollection = db.collection(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  const cursor = searchesCollection.find({
    requestHash: { $exists: false },
  })
  await processCursorInBatch(cursor, async (searches) => {
    const bulkUpdates = searches.map((search) => {
      return {
        updateOne: {
          filter: { _id: search._id },
          update: {
            $set: {
              requestHash: generateChecksum(
                getSortedObject(
                  omit(search.request, ['fuzzinessRange', 'fuzziness'])
                )
              ),
            },
          },
        },
      }
    })
    await searchesCollection.bulkWrite(bulkUpdates)
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
