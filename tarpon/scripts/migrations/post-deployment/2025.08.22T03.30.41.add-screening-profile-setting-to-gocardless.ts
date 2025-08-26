import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === '4c9cdf0251') {
    const dynamoDb = getDynamoDbClient()
    const tenantRepository = new TenantRepository(tenant.id, { dynamoDb })
    const tenantSettings = await tenantRepository.getTenantSettings()
    await tenantRepository.createOrUpdateTenantSettings({
      ...tenantSettings,
      sanctions: {
        ...tenantSettings.sanctions,
        aggregateScreeningProfileData: true,
      },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
