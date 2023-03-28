import { migrateAllTenants } from '../utils/tenant'
import { AccountsService, Tenant } from '@/services/accounts'
import { RoleService } from '@/services/roles'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  if (!process.env.ENV?.startsWith('prod')) {
    return
  }
  const dynamoDb = await getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: 'flagright.eu.auth0.com' },
    { mongoDb }
  )
  const rolesService = new RoleService({
    auth0Domain: 'flagright.eu.auth0.com',
  })
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })

  const settings = await tenantRepository.getTenantSettings()
  if (!settings) {
    return
  }
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
