import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService, Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
  const allAccounts = await accountsService.getTenantAccounts(tenant)
  await Promise.all(
    allAccounts.map((a) =>
      accountsService.updateAuth0User(a.id, {
        app_metadata: { blockedReason: 'DELETED' }, // So that we mark current users as deleted
        blocked: true,
      })
    )
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
