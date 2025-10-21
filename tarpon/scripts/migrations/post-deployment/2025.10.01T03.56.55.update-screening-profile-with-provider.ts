import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { ScreeningProfileService } from '@/services/screening-profile'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (!hasFeature('SANCTIONS')) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const screeningProfileService = new ScreeningProfileService(tenant.id, {
    dynamoDb,
  })
  const defaultScreeningProviders = getDefaultProviders().filter(
    (provider) => provider === 'dowjones' || provider === 'acuris'
  )
  const provider = defaultScreeningProviders[0]
  if (!provider) {
    return
  }
  const screeningProfiles = await screeningProfileService.getScreeningProfiles()
  for (const screeningProfile of screeningProfiles.items) {
    await screeningProfileService.updateScreeningProfile(
      screeningProfile.screeningProfileId,
      {
        ...screeningProfile,
        provider,
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
