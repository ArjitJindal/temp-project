import { migrateAllTenants } from '../utils/tenant'
import { getConfig } from '../utils/config'
import { AccountsService, Tenant } from '@/services/accounts'
import { AccountsConfig } from '@/lambdas/console-api-account/app'
import { RoleService } from '@/services/roles'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const config = getConfig()
  const dynamoDb = await getDynamoDbClient()
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const rolesService = new RoleService(config.application as AccountsConfig)
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })

  tenantRepository.tenantId = tenant.id
  const settings = await tenantRepository.getTenantSettings()
  let features = settings.features
  if (settings.features?.indexOf('RBAC') == -1) {
    features = [...settings.features, 'RBAC']
  }
  console.log(`Updating features for ${tenant.id}`)
  await tenantRepository.createOrUpdateTenantSettings({
    features,
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
