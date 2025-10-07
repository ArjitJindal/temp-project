import isEmpty from 'lodash/isEmpty'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { TenantService } from '@/services/tenants'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const tenantService = new TenantService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const tenantSettings = await tenantService.getTenantSettings()
  const newTenantSettings = {
    ...tenantSettings,
    features: tenantSettings.features?.filter(
      (feature) => (feature as string) !== 'CRM_FRESHDESK'
    ),
  }
  if (!isEmpty(newTenantSettings)) {
    await tenantService.createOrUpdateTenantSettings(newTenantSettings)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
