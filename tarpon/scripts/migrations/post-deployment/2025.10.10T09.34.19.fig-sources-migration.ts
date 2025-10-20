import { AnyBulkWriteOperation, Collection } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongo-table-names'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ScreeningProfileService } from '@/services/screening-profile'
import {
  getSanctionSourceDetails,
  sanitizeEntities,
} from '@/services/sanctions/providers/utils'
import { SanctionsSearchProps } from '@/services/sanctions/types'

const PERSON_COLLECTION_NAME = 'sanctions-acuris-person'
const RULE_INSTANCE_SCREENING_PROFILE_MAP = {
  'R-17.1': 'SCP-1',
  'R-17.2': 'SCP-2',
}
async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '78c5a44b9b') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const dynamoDb = getDynamoDbClient()
  const screeningProfileService = new ScreeningProfileService(tenant.id, {
    dynamoDb,
  })
  const ruleSeventeenPointOneSources = await getSanctionSourceDetails(
    {
      screeningProfileId: RULE_INSTANCE_SCREENING_PROFILE_MAP['R-17.1'],
      searchTerm: '',
    },
    screeningProfileService
  )
  const ruleSeventeenPointTwoSources = await getSanctionSourceDetails(
    {
      screeningProfileId: RULE_INSTANCE_SCREENING_PROFILE_MAP['R-17.2'],
      searchTerm: '',
    },
    screeningProfileService
  )

  const sanctionsPersonCollection = db.collection<SanctionsEntity>(
    PERSON_COLLECTION_NAME
  )
  const sanctionsHitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  for (const ruleInstanceId of Object.keys(
    RULE_INSTANCE_SCREENING_PROFILE_MAP
  )) {
    await updateSanctionsHit({
      sanctionsHitsCollection,
      sanctionsPersonCollection,
      sources:
        ruleInstanceId === 'R-17.1'
          ? ruleSeventeenPointOneSources
          : ruleSeventeenPointTwoSources,
      ruleInstanceId,
    })
  }
}

async function updateSanctionsHit({
  sanctionsHitsCollection,
  sanctionsPersonCollection,
  sources,
  ruleInstanceId,
}: {
  sanctionsHitsCollection: Collection<SanctionsHit>
  sanctionsPersonCollection: Collection<SanctionsEntity>
  sources: SanctionsSearchProps
  ruleInstanceId: string
}) {
  let count = 0
  const sanctionsHitsCursor = sanctionsHitsCollection.find({
    'entity.provider': 'acuris',
    createdAt: { $lt: 1753401600000 },
    'hitContext.ruleInstanceId': ruleInstanceId,
  })
  await processCursorInBatch(
    sanctionsHitsCursor,
    async (sanctionsHits) => {
      const sanctionsPersonHitEntityIds = sanctionsHits.map(
        (sanctionsHit) => sanctionsHit.entity.id
      )
      const allEntities = await sanctionsPersonCollection
        .find(
          { id: { $in: sanctionsPersonHitEntityIds } },
          {
            projection: {
              rawResponse: 0,
            },
          }
        )
        .toArray()
      const sanitizedEntities =
        (await sanitizeEntities({
          data: allEntities,
          ...sources,
        })) ?? []
      if (sanitizedEntities.length === 0) {
        return
      }
      const allEntitiesMap = new Map<string, SanctionsEntity>()
      sanitizedEntities.forEach((entity) => {
        allEntitiesMap.set(entity.id, entity)
      })
      const bulkOps: AnyBulkWriteOperation<SanctionsHit>[] = []
      sanctionsHits.forEach((sanctionsHit) => {
        const entity = allEntitiesMap.get(sanctionsHit.entity.id)
        if (entity) {
          bulkOps.push({
            updateOne: {
              filter: { sanctionsHitId: sanctionsHit.sanctionsHitId },
              update: {
                $set: {
                  entity: {
                    ...sanctionsHit.entity,
                    sanctionsSources: entity.sanctionsSources,
                    mediaSources: entity.mediaSources,
                    pepSources: entity.pepSources,
                    otherSources: entity.otherSources,
                    resourceId: entity.resourceId,
                  },
                },
              },
            },
          })
        }
      })
      await sanctionsHitsCollection.bulkWrite(bulkOps)
      count += bulkOps.length
      console.log(
        `Updated ${count} sanctions hits for rule instance ${ruleInstanceId}`
      )
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
