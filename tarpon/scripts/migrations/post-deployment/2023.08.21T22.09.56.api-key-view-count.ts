import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const tenantSettings = await tenantRepository.getTenantSettings()

  const limits = tenantSettings.limits || {}

  if (!limits.apiKeyView) {
    await tenantRepository.createOrUpdateTenantSettings({
      limits: {
        ...limits,
        apiKeyView: 2,
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
