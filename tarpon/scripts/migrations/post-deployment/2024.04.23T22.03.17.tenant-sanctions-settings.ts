import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepo = new TenantRepository(tenant.id, { dynamoDb })
  const tenantSettings = await tenantRepo.getTenantSettings()

  if ((tenantSettings as any)?.complyAdvantageSearchProfileId) {
    await tenantRepo.deleteTenantSettings([
      'complyAdvantageSearchProfileId',
    ] as any)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
