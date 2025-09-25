import { migrateAllTenants } from '../utils/tenant'
import { AccountsService } from '@/services/accounts'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isDemoTenant } from '@/utils/tenant-id'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  const dynamoDb = getDynamoDbClient()
  const auth0 = new AccountsService(
    { auth0Domain, useCache: false },
    { dynamoDb }
  )

  const tenantFromAuth0 = await auth0.getTenantById(tenant.id)

  if (tenantFromAuth0) {
    await auth0.cache.createOrganization(tenant.id, {
      params: tenantFromAuth0,
      type: 'DATABASE',
    })
  }

  const accounts = await auth0.getTenantAccounts(tenant)

  for (const account of accounts) {
    await auth0.patchUser(tenant, account.id, {})
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
