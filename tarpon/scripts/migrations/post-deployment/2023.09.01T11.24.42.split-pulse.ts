import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Feature } from '@/@types/openapi-internal/Feature'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()

  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
  })

  const tenantSettings = await tenantRepository.getTenantSettings()

  if ((tenantSettings.features as (Feature | 'PULSE')[])?.includes('PULSE')) {
    await tenantRepository.createOrUpdateTenantSettings({
      features: (tenantSettings?.features as (Feature | 'PULSE')[])
        ?.filter((feature) => feature !== 'PULSE')
        ?.concat(['RISK_LEVELS', 'RISK_SCORING']) as Feature[],
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
