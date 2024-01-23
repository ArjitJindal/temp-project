import { TenantService } from '@/services/tenants'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

export const up = async () => {
  const allTenants = await TenantService.getAllTenants()
  const dynamoDb = getDynamoDbClient()

  for (const tenant of allTenants) {
    const tenantRepository = new TenantRepository(tenant.tenant.id, {
      dynamoDb,
    })

    await tenantRepository.createOrUpdateTenantSettings({
      auth0Domain: tenant.auth0Domain,
    })
  }
}
export const down = async () => {
  // skip
}
