import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { ScreeningProfileRepository } from '@/services/screening-profile/repositories/screening-profile-repository'
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/AdverseMediaSourceRelevance'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const repo = new ScreeningProfileRepository(tenant.id, dynamoDb)
  const screeningProfiles = await repo.getScreeningProfiles()
  const defaultScreeningProfile = screeningProfiles.items.find(
    (profile) => !profile.createdBy && !profile.updatedBy
  )
  console.log(
    `Default screening profile: ${defaultScreeningProfile?.screeningProfileId} ${tenant.id}`
  )
  if (!defaultScreeningProfile) {
    return
  }
  console.log(
    `Updating default screening profile: ${defaultScreeningProfile.screeningProfileId}`
  )
  await repo.updateScreeningProfile(dynamoDb, defaultScreeningProfile, {
    ...defaultScreeningProfile,
    adverseMedia: {
      relevance: ADVERSE_MEDIA_SOURCE_RELEVANCES,
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
