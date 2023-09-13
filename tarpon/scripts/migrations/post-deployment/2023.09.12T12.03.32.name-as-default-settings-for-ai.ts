import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepo = new TenantRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  await tenantRepo.createOrUpdateTenantSettings({
    aiFieldsEnabled: ['name'],
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
