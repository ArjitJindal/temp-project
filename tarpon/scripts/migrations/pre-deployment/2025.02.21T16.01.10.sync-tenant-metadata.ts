import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { TenantService } from '@/services/tenants'
import { AccountsService } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { isDemoTenant } from '@/utils/tenant'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })
  const tenantService = new TenantService(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const tenantSettings: TenantSettings = await tenantService.getTenantSettings()

  await accountsService.updateAuth0TenantMetadata(tenant.id, {
    mfaEnabled: tenantSettings.mfaEnabled ? true : false,
    ...(tenantSettings.passwordResetDays != null && {
      passwordResetDays: tenantSettings.passwordResetDays,
    }),
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
