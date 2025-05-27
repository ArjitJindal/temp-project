import { omit } from 'lodash'
import { Document } from 'mongodb'
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

  // adding request hash
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

  const aggCursor = db
    .collection(SANCTIONS_SEARCHES_COLLECTION(tenant.id))
    .aggregate([
      // oldest timestamp document
      {
        $sort: {
          createdAt: 1,
        },
      },
      // grouping by requestHash
      {
        $group: {
          _id: '$requestHash',
          docs: { $push: '$$ROOT' },
        },
      },
      // adding version to each document
      {
        $project: {
          docs: 1,
          computedKey: '$_id',
          versionedDocs: {
            $map: {
              input: { $range: [0, { $size: '$docs' }] },
              as: 'idx',
              in: {
                $mergeObjects: [
                  { $arrayElemAt: ['$docs', '$$idx'] },
                  { version: '$$idx' },
                ],
              },
            },
          },
        },
      },
      // unwinding each versioned document
      { $unwind: '$versionedDocs' },
      // replacing the document
      { $replaceRoot: { newRoot: '$versionedDocs' } },
    ])

  let buffer: Document[] = []
  const BATCH_SIZE = 1000

  async function flushBuffer() {
    if (buffer.length === 0) {
      return
    }
    const bulkOps = buffer.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: false,
      },
    }))
    await searchesCollection.bulkWrite(bulkOps, { ordered: false })
    buffer = []
  }

  while (await aggCursor.hasNext()) {
    const doc = await aggCursor.next()
    if (doc) {
      buffer.push(doc)
    }

    if (buffer.length >= BATCH_SIZE) {
      await flushBuffer()
    }
  }

  await flushBuffer()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
