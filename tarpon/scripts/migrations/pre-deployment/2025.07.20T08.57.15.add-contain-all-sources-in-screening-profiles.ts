import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { ScreeningProfileRepository } from '@/services/screening-profile/repositories/screening-profile-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION } from '@/utils/mongodb-definitions'
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/AdverseMediaSourceRelevance'
import { SANCTIONS_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/SanctionsSourceRelevance'
import { PEP_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/PEPSourceRelevance'
import { REL_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/RELSourceRelevance'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const repo = new ScreeningProfileRepository(tenant.id, dynamoDb)
  const screeningProfiles = await repo.getScreeningProfiles()
  if (!screeningProfiles.items.length) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const sanctionsSourcesCount =
    (await mongoDb
      .db()
      .collection(SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION())
      .countDocuments()) + ADVERSE_MEDIA_SOURCE_RELEVANCES.length
  for (const screeningProfile of screeningProfiles.items) {
    const selectedSourcesCount =
      (screeningProfile.sanctions?.sourceIds?.length ?? 0) +
      (screeningProfile.pep?.sourceIds?.length ?? 0) +
      (screeningProfile.rel?.sourceIds?.length ?? 0) +
      (screeningProfile.adverseMedia?.relevance?.length ?? 0)
    const containAllSources =
      selectedSourcesCount === sanctionsSourcesCount &&
      screeningProfile.sanctions?.relevance?.length ===
        SANCTIONS_SOURCE_RELEVANCES.length &&
      screeningProfile.pep?.relevance?.length ===
        PEP_SOURCE_RELEVANCES.length &&
      screeningProfile.rel?.relevance?.length === REL_SOURCE_RELEVANCES.length
    await repo.updateScreeningProfile(dynamoDb, screeningProfile, {
      ...screeningProfile,
      containAllSources,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
