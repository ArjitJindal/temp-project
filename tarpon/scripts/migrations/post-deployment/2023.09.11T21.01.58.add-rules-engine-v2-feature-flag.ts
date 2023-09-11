import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const tenantData = await tenantRepository.getTenantSettings(['features'])

  if (tenantData.features?.includes('RULES_ENGINE_V2')) {
    return
  }

  await tenantRepository.createOrUpdateTenantSettings({
    features: [...(tenantData.features || []), 'RULES_ENGINE_V2'],
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
