import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { AccountsService, Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService({ auth0Domain }, { mongoDb })

  const accounts = await accountsService.getTenantAccounts(tenant)
  console.log(`Migrating ${accounts.length} accounts for tenant ${tenant.id}`)
  await accountsService.insertAuth0UserToMongo(tenant.id, accounts)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
