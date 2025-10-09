import compact from 'lodash/compact'
import { AnyBulkWriteOperation } from 'mongodb'
import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongo-table-names'
import { Tenant } from '@/@types/tenant'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  try {
    if (
      hasFeature('OPEN_SANCTIONS') ||
      hasFeature('DOW_JONES') ||
      hasFeature('ACURIS')
    ) {
      const mongoDb = await getMongoDbClient()
      const db = mongoDb.db()
      const sanctionsCollection = db.collection(SANCTIONS_COLLECTION(tenant.id))
      const sanctionsHitsCollection = db.collection(
        SANCTIONS_HITS_COLLECTION(tenant.id)
      )
      const sanctionsWhitelistCollection = db.collection(
        SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
      )

      // Create temporary indexes
      await sanctionsHitsCollection.createIndex(
        { 'entity.id': 1 },
        { name: 'temp_id_index' }
      )
      await sanctionsWhitelistCollection.createIndex(
        { 'sanctionsEntity.id': 1 },
        { name: 'temp_sanctions_entity_id_index' }
      )

      await sanctionsCollection.createIndex(
        { id: 1 },
        { name: 'temp_id_index' }
      )

      await processCursorInBatch(
        sanctionsHitsCollection.find({}),
        async (sanctionsHits) => {
          const sanctionsOps = await pMap(
            sanctionsHits,
            async (hit) => {
              const sanctions = await sanctionsCollection.findOne({
                id: hit.entity.id,
              })
              if (sanctions) {
                return {
                  hitsWrite: {
                    updateOne: {
                      filter: { 'entity.id': hit.entity.id },
                      update: {
                        $set: { 'entity.yearOfBirth': sanctions.yearOfBirth },
                      },
                      upsert: false,
                    },
                  },
                  whitelistWrite: {
                    updateOne: {
                      filter: { 'sanctionsEntity.id': hit.entity.id },
                      update: {
                        $set: {
                          'sanctionsEntity.yearOfBirth': sanctions.yearOfBirth,
                        },
                      },
                      upsert: false,
                    },
                  },
                }
              }
              return null
            },
            { concurrency: 5 }
          )

          const sanctionsHitsOps = compact(
            sanctionsOps.map((ops) => ops?.hitsWrite)
          )
          const sanctionsWhitelistOps = compact(
            sanctionsOps.map((ops) => ops?.whitelistWrite)
          )
          if (sanctionsHitsOps.length > 0) {
            await sanctionsHitsCollection.bulkWrite(
              sanctionsHitsOps as AnyBulkWriteOperation[]
            )
          }
          if (sanctionsWhitelistOps.length > 0) {
            await sanctionsWhitelistCollection.bulkWrite(
              sanctionsWhitelistOps as AnyBulkWriteOperation[]
            )
          }
        },
        {
          mongoBatchSize: 100,
          processBatchSize: 10,
          debug: true,
        }
      )

      // Drop temporary indexes after migration
      await sanctionsHitsCollection.dropIndex('temp_id_index')
      await sanctionsWhitelistCollection.dropIndex(
        'temp_sanctions_entity_id_index'
      )
      await sanctionsCollection.dropIndex('temp_id_index')
    }
  } catch (error) {
    console.error('Error during migration:', error)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
