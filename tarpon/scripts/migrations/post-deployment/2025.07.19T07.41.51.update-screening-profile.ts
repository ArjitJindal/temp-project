import { compact } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { ScreeningProfileRepository } from '@/services/screening-profile/repositories/screening-profile-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collections = await db.listCollections().toArray()
  if (
    !collections.some(
      (c) => c.name === SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION()
    )
  ) {
    return
  }
  const sources = await db
    .collection(SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION())
    .find(
      {},
      {
        projection: {
          id: 1,
          refId: 1,
        },
      }
    )
    .toArray()
  const dynamoDb = getDynamoDbClient()
  const repo = new ScreeningProfileRepository(tenant.id, dynamoDb)
  const screeningProfiles = (await repo.getScreeningProfiles()).items

  for (const screeningProfile of screeningProfiles) {
    const updatedSanctionsSources = compact(
      (screeningProfile.sanctions?.sourceIds ?? []).map((sourceId) => {
        return sources.find((s) => s.id === sourceId)?.refId
      })
    )
    const updatedPepSources = compact(
      (screeningProfile.pep?.sourceIds ?? []).map((sourceId) => {
        return sources.find((s) => s.id === sourceId)?.refId
      })
    )
    const updatedRelSources = compact(
      (screeningProfile.rel?.sourceIds ?? []).map((sourceId) => {
        return sources.find((s) => s.id === sourceId)?.refId
      })
    )
    await repo.updateScreeningProfile(dynamoDb, screeningProfile, {
      ...screeningProfile,
      sanctions: {
        ...screeningProfile.sanctions,
        sourceIds: updatedSanctionsSources,
      },
      pep: {
        ...screeningProfile.pep,
        sourceIds: updatedPepSources,
      },
      rel: {
        ...screeningProfile.rel,
        sourceIds: updatedRelSources,
      },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  await db
    .collection(SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION())
    .updateMany({}, [
      {
        $set: {
          id: '$refId',
        },
      },
    ])
}
export const down = async () => {
  // skip
}
