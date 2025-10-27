import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()

  const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
  const tenantSettings = await tenantRepository.getTenantSettings()
  if (
    !tenantSettings.webhookSettings ||
    tenantSettings.webhookSettings.maxRetryHours === undefined
  ) {
    await tenantRepository.createOrUpdateTenantSettings({
      ...tenantSettings,
      webhookSettings: {
        retryBackoffStrategy:
          tenantSettings.webhookSettings?.retryBackoffStrategy ?? 'LINEAR',
        retryOnlyFor: tenantSettings.webhookSettings?.retryOnlyFor ?? [
          '3XX',
          '4XX',
          '5XX',
        ],
        maxRetryHours: 24,
        maxRetryReachedAction:
          tenantSettings.webhookSettings?.maxRetryReachedAction ??
          (envIs('prod') ? 'IGNORE' : 'DISABLE_WEBHOOK'),
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
