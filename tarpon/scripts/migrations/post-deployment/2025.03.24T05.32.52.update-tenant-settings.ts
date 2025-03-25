import { migrateAllTenants } from '../utils/tenant'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { Tenant } from '@/services/accounts/repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SanctionsDataProviders } from '@/services/sanctions/types'
// update tenant settings to exclude warnings except for capimoney
async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const providers = getDefaultProviders()
  if (providers.includes(SanctionsDataProviders.COMPLY_ADVANTAGE)) {
    const dynamoDb = getDynamoDbClient()
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })
    const { sanctions } = await tenantRepository.getTenantSettings([
      'sanctions',
    ])
    const complyAdvantageSettings = sanctions?.providerScreeningTypes?.find(
      (provider) =>
        provider.provider === SanctionsDataProviders.COMPLY_ADVANTAGE
    ) ?? {
      screeningTypes: ['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'],
      provider: SanctionsDataProviders.COMPLY_ADVANTAGE,
      entityTypes: ['PERSON', 'BUSINESS', 'BANK'],
    }
    const newTenantSettings = {
      ...sanctions,
      providerScreeningTypes: [
        ...(sanctions?.providerScreeningTypes?.filter(
          (provider) =>
            provider.provider !== SanctionsDataProviders.COMPLY_ADVANTAGE
        ) ?? []),
        {
          ...complyAdvantageSettings,
          screeningTypes:
            tenantId === 'QYF2BOXRJI'
              ? ['SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'WARNINGS']
              : ['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'],
        },
      ],
    }
    await tenantRepository.createOrUpdateTenantSettings({
      sanctions: newTenantSettings,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
