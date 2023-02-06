import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })

  const tenantSettings = await tenantRepository.getTenantSettings(['features'])
  const features = tenantSettings.features?.filter(
    (feature) =>
      !['PULSE_ARS_CALCULATION', 'PULSE_KRS_CALCULATION'].includes(feature)
  )

  await tenantRepository.createOrUpdateTenantSettings({
    features: features || [],
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
