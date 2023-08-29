import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantService } from '@/services/tenants'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantService = new TenantService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  await tenantService.createOrUpdateTenantSettings({
    isProductionAccessEnabled: true,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
