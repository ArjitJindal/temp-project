import { MongoClient } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'

const DRY_RUN = false
const entityCache: {
  [searchId: string]: ComplyAdvantageSearchHit | null | undefined
} = {}

async function getEntityById(
  mongoDb: MongoClient,
  tenantId: string,
  entityId: string
): Promise<ComplyAdvantageSearchHit | null> {
  if (entityId in entityCache) {
    return entityCache[entityId] ?? null
  }
  const collection = mongoDb
    .db()
    .collection<SanctionsSearchHistory>(SANCTIONS_SEARCHES_COLLECTION(tenantId))
  const historyItem = await collection.findOne(
    {
      'response.rawComplyAdvantageResponse.content.data.hits.doc.id': entityId,
    },
    {
      sort: {
        'response.rawComplyAdvantageResponse.content.data.created_at': -1,
      },
    }
  )
  if (historyItem) {
    for (const hit of historyItem?.response?.rawComplyAdvantageResponse?.content
      ?.data?.hits ?? []) {
      if (hit.doc.id) {
        entityCache[hit.doc.id] = hit
      }
    }
  }
  if (entityId in entityCache) {
    return entityCache[entityId] ?? null
  }
  return null
}

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const hitsRepository = new SanctionsHitsRepository(tenant.id, mongoDb)
  let counter = 0

  const collection = mongoDb
    .db()
    .collection<SanctionsHit>(SANCTIONS_HITS_COLLECTION(tenant.id))

  for await (const hit of collection.find({
    caMatchTypesDetails: { $eq: undefined },
  })) {
    if (hit.caEntity.id) {
      const entity = await getEntityById(mongoDb, tenant.id, hit.caEntity.id)
      if (entity != null && entity.match_types_details != null) {
        logger.info(`Migrating hit ${hit.sanctionsHitId} (${++counter})`)

        if (!DRY_RUN) {
          await hitsRepository.updateHitsByIds([hit.sanctionsHitId], {
            caMatchTypesDetails: entity.match_types_details,
          })
        }
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
