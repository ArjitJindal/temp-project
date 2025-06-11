import { migrateAllTenants } from '../utils/tenant'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts/repository'
import { ScreeningProfileService } from '@/services/screening-profile'
import { SanctionsService } from '@/services/sanctions'
import { CounterRepository } from '@/services/counter/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantService } from '@/services/tenants'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'

async function migrateTenant(tenant: Tenant) {
  if (!hasFeature('ACURIS')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const counterRepository = new CounterRepository(tenant.id, mongoDb)
  const sanctionsService = new SanctionsService(tenant.id)
  const screeningProfileService = new ScreeningProfileService(
    tenant.id,
    sanctionsService
  )
  const tenantService = new TenantService(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const tenantSettings = await tenantService.getTenantSettings()
  const acurisSanctionsSearchType =
    tenantSettings.sanctions?.providerScreeningTypes?.find(
      (type) => type.provider === 'acuris'
    )?.screeningTypes ?? [
      'SANCTIONS',
      'PEP',
      'REGULATORY_ENFORCEMENT_LIST',
      'ADVERSE_MEDIA',
    ]

  await screeningProfileService.updateScreeningProfilesOnSanctionsSettingsChange(
    acurisSanctionsSearchType as AcurisSanctionsSearchType[],
    dynamoDb
  )
  const createDefaultScreeningProfile =
    await screeningProfileService.checkIfDefaultScreeningProfileExists(dynamoDb)
  if (createDefaultScreeningProfile) {
    return
  }
  await screeningProfileService.createDefaultScreeningProfile(
    dynamoDb,
    counterRepository,
    acurisSanctionsSearchType as AcurisSanctionsSearchType[]
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
