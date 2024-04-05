import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb: getDynamoDbClient(),
  })
  let settings = await tenantRepository.getTenantSettings()

  // @ts-expect-error tenantTimezone moved from root settings to settings.defaultValues
  const tenantTimezone = settings.tenantTimezone
  if (tenantTimezone != null) {
    settings = {
      ...settings,
      defaultValues: {
        ...settings.defaultValues,
        tenantTimezone:
          tenantTimezone ?? settings.defaultValues?.tenantTimezone,
      },
    }
    await tenantRepository.createOrUpdateTenantSettings(settings)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
