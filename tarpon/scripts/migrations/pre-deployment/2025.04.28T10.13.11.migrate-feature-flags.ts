import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, { dynamoDb })
  const settings = await tenantRepository.getTenantSettings()
  // if tenant has feature flag pnb skip
  if (settings.features?.includes('PNB')) {
    return
  }

  await tenantRepository.createOrUpdateTenantSettings({
    ...settings,
    features: [...(settings?.features ?? []), 'NEW_FEATURES'],
  })
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
