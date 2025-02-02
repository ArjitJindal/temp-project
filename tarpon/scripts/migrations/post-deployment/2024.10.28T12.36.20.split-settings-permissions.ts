import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const dynamoDb = getDynamoDbClient()
  const rolesService = RoleService.getInstance(dynamoDb, auth0Domain)

  const roles = await rolesService.getTenantRoles(tenant.id)
  for (const role of roles) {
    if (role.permissions.includes('settings:organisation:write')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'settings:system-config:read',
        'settings:system-config:write',
        'settings:case-management:read',
        'settings:case-management:write',
        'settings:security:read',
        'settings:security:write',
        'settings:transactions:read',
        'settings:transactions:write',
        'settings:users:read',
        'settings:users:write',
        'settings:rules:read',
        'settings:rules:write',
        'settings:risk-scoring:read',
        'settings:risk-scoring:write',
        'settings:notifications:read',
        'settings:notifications:write',
        'settings:add-ons:read',
        'settings:add-ons:write',
      ])
    } else if (role.permissions.includes('settings:organisation:read')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'settings:system-config:read',
        'settings:case-management:read',
        'settings:security:read',
        'settings:transactions:read',
        'settings:users:read',
        'settings:rules:read',
        'settings:risk-scoring:read',
        'settings:notifications:read',
        'settings:add-ons:read',
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
