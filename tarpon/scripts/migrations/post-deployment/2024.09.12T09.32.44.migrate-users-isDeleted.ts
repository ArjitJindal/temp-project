import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AccountsService } from '@/services/accounts'
import { TenantService } from '@/services/tenants'

export const up = async () => {
  const mongoDb = await getMongoDbClient()
  const tenants = await TenantService.getAllTenants()

  for (const { auth0Domain, tenant } of tenants) {
    const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
    const allAccounts = await accountsService.getTenantAccounts(tenant)
    await Promise.all(
      allAccounts.map(async (a) => {
        const isBlocked = a.blocked

        if (isBlocked) {
          await accountsService.blockAccount(tenant.id, a.id, 'DELETED')
        }
      })
    )
  }
}
export const down = async () => {
  // skip
}
