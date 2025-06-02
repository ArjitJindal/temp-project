import { omit } from 'lodash'
import { ObjectId } from 'mongodb'
import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClientDb, processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  // skipping for sia-partners(sandbox)
  if (tenant.id === 'sia-partners' && envIs('sandbox')) {
    return
  }

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

  const requestHashes = await searchesCollection.distinct('requestHash', {
    requestHash: { $exists: true, $ne: null },
  })

  const BATCH_SIZE = 1000
  const processARequestHash = async (requestHash: string) => {
    let batchProcessedCounter = 0

    const isProcessing = true
    while (isProcessing) {
      const batchCursor = searchesCollection
        .find({ requestHash: requestHash })
        .sort({ createdAt: 1 })
        .project({ _id: 1 })
        .skip(batchProcessedCounter)
        .limit(BATCH_SIZE)

      const batch = await batchCursor.toArray()
      if (batch.length === 0) {
        break
      }

      const bulkOps: {
        updateOne: {
          filter: { _id: ObjectId }
          update: { $set: { version: number } }
          upsert: boolean
        }
      }[] = []

      batch.forEach((doc, index) => {
        const version = index + batchProcessedCounter
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { version: version } },
            upsert: false,
          },
        })
      })

      if (bulkOps.length > 0) {
        await searchesCollection.bulkWrite(bulkOps, { ordered: false })
      }

      batchProcessedCounter += batch.length
    }
  }

  await pMap(requestHashes, processARequestHash, { concurrency: 100 })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
