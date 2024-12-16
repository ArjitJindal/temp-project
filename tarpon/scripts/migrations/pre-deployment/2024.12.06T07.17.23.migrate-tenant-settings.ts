import { migrateAllTenants } from '../utils/tenant'
import { WebhookSettings } from '@/@types/openapi-internal/WebhookSettings'
import { Tenant } from '@/services/accounts'
import { envIs } from '@/utils/env'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const defaultWebhookSettings: WebhookSettings = {
    retryBackoffStrategy: 'LINEAR',
    retryOnlyFor: ['3XX', '4XX', '5XX'],
    maxRetryHours: envIs('prod') ? 96 : 24,
    maxRetryReachedAction: envIs('prod') ? 'IGNORE' : 'DISABLE_WEBHOOK',
  }

  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })

  await tenantRepository.createOrUpdateTenantSettings({
    webhookSettings: defaultWebhookSettings,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
