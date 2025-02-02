import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const dynamoDb = getDynamoDbClient()
  // if tenant as settings:organization:write, then we need to add new roles
  const rolesService = RoleService.getInstance(dynamoDb, auth0Domain)
  const roles = await rolesService.getTenantRoles(tenant.id)
  for (const role of roles) {
    if (role.permissions.includes('settings:organisation:write')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'accounts:overview:read',
        'accounts:overview:write',
        'roles:overview:read',
        'roles:overview:write',
      ])
    } else if (role.permissions.includes('settings:organisation:read')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'accounts:overview:read',
        'roles:overview:read',
      ])
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
