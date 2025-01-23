import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const rolesService = new RoleService({
    auth0Domain,
  })

  const roles = await rolesService.getTenantRoles(tenant.id)
  for (const role of roles) {
    if (role.permissions.includes('lists:all:write')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'lists:whitelist:write',
        'lists:blacklist:write',
        'lists:whitelist:read',
        'lists:blacklist:read',
      ])
    } else if (role.permissions.includes('lists:all:read')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'lists:whitelist:read',
        'lists:blacklist:read',
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
