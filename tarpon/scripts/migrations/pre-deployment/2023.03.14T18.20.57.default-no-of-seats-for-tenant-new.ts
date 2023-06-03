import { migrateAllTenants } from '../utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'

const DEFAULT_SEATS_COUNT = 20

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, { dynamoDb })
  const tenantSettings = await tenantRepository.getTenantSettings()
  await tenantRepository.createOrUpdateTenantSettings({
    limits: {
      ...(tenantSettings?.limits ?? {}),
      seats: DEFAULT_SEATS_COUNT,
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
