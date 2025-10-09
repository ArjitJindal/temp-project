import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongo-table-names'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
const PERSON_COLLECTION_NAME = 'sanctions-acuris-person'
const BUSINESS_COLLECTION_NAME = 'sanctions-acuris-business'
async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '8dd4272ea1') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const sanctionsPersonCollection = db.collection<SanctionsEntity>(
    PERSON_COLLECTION_NAME
  )
  const sanctionsBusinessCollection = db.collection<SanctionsEntity>(
    BUSINESS_COLLECTION_NAME
  )
  const sanctionsHitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  const sanctionsHitsCursor = sanctionsHitsCollection.find({
    'entity.provider': 'acuris',
    createdAt: { $lt: 1753401600000 },
  })
  await processCursorInBatch(
    sanctionsHitsCursor,
    async (sanctionsHits) => {
      const sanctionsPersonHitEntityIds = sanctionsHits
        .filter((sanctionsHit) => sanctionsHit.entity.entityType === 'PERSON')
        .map((sanctionsHit) => sanctionsHit.entity.id)
      const sanctionsBusinessHitEntityIds = sanctionsHits
        .filter((sanctionsHit) => sanctionsHit.entity.entityType === 'BUSINESS')
        .map((sanctionsHit) => sanctionsHit.entity.id)
      const allEntities = (
        await Promise.all([
          sanctionsPersonCollection
            .find(
              { id: { $in: sanctionsPersonHitEntityIds } },
              {
                projection: {
                  rawResponse: 0,
                },
              }
            )
            .toArray(),
          sanctionsBusinessCollection
            .find(
              { id: { $in: sanctionsBusinessHitEntityIds } },
              {
                projection: {
                  rawResponse: 0,
                },
              }
            )
            .toArray(),
        ])
      ).flat()
      const allEntitiesMap = new Map<string, SanctionsEntity>()
      allEntities.forEach((entity) => {
        allEntitiesMap.set(entity.id, entity)
      })
      const bulkOps: AnyBulkWriteOperation<SanctionsHit>[] = []
      sanctionsHits.forEach((sanctionsHit) => {
        const entity = allEntitiesMap.get(sanctionsHit.entity.id)
        if (entity) {
          bulkOps.push({
            updateOne: {
              filter: { id: sanctionsHit.sanctionsHitId },
              update: { $set: { entity: entity } },
            },
          })
        }
      })
      await sanctionsHitsCollection.bulkWrite(bulkOps)
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 1000,
      debug: true,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
