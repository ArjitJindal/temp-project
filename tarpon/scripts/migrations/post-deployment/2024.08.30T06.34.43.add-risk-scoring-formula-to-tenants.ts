import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantService } from '@/services/tenants'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantService = new TenantService(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const tenantSettings = await tenantService.getTenantSettings()

  await tenantService.createOrUpdateTenantSettings({
    ...(tenantSettings ?? {}),
    riskScoringCraEnabled: true,
    riskScoringAlgorithm: {
      type: 'FORMULA_LEGACY_MOVING_AVG',
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
