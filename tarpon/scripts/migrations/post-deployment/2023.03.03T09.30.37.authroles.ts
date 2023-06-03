import { migrateAllTenants } from '../utils/tenant'
import { AccountsService, Tenant } from '@/services/accounts'
import { RoleService } from '@/services/roles'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (process.env.ENV === 'local') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
  const rolesService = new RoleService({
    auth0Domain,
  })
  const users = await accountsService.getTenantAccounts(tenant)
  await Promise.all(
    users
      .map((u) => {
        if (u.role == 'user') {
          console.log(`setting ${u.email} with ${u.role} as analyst`)
          return rolesService.setRole(tenant.id, u.id, 'analyst')
        }
        if (u.role == 'admin') {
          console.log(`setting ${u.email} with ${u.role} as admin`)
          return rolesService.setRole(tenant.id, u.id, 'admin')
        }
        return null
      })
      .filter((p) => p)
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
