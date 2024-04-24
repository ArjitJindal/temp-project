import { migrateAllTenants } from '../utils/tenant'
import { envIs } from '@/utils/env'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SanctionsSettingsMarketType } from '@/@types/openapi-internal/SanctionsSettingsMarketType'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepo = new TenantRepository(tenant.id, { dynamoDb })
  const tenantSettings = await tenantRepo.getTenantSettings()

  if (!tenantSettings?.features?.includes('SANCTIONS')) {
    return
  }

  if (envIs('prod')) {
    const mapping: { [key: string]: SanctionsSettingsMarketType } = {
      nexpay: 'EMERGING',
      kevin: 'EMERGING',
      mistertango: 'EMERGING',
      pesawise: 'EMERGING',
      capimoney: 'FIRST_WORLD',
      helloclever: 'EMERGING',
      sciopay: 'FIRST_WORLD',
      sipelatam: 'EMERGING',
    }
    const marketType = mapping[tenant.name]
    if (!marketType) {
      throw new Error(`Market type not found for tenant ${tenant.name}`)
    }
    const newSettings: Partial<TenantSettings> = { sanctions: { marketType } }
    if (tenant.name === 'kevin' && newSettings.sanctions) {
      newSettings.sanctions.customSearchProfileId = (
        tenantSettings as any
      ).complyAdvantageSearchProfileId
    }
    await tenantRepo.createOrUpdateTenantSettings(newSettings)
  } else {
    await tenantRepo.createOrUpdateTenantSettings({
      // We don't need to differentiate between FIRST_WORLD and EMERGING in non-prod environments
      sanctions: { marketType: 'EMERGING' },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
