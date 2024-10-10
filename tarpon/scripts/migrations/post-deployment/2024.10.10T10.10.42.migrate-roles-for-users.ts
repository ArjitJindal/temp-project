import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  // if tenant as settings:organization:write, then we need to add new roles
  const rolesService = new RoleService({
    auth0Domain,
  })

  const roles = await rolesService.getTenantRoles(tenant.id)
  for (const role of roles) {
    if (role.permissions.includes('users:user-overview:write')) {
      await rolesService.updateRole(tenant.id, role.id, {
        ...role,
        permissions: [
          ...role.permissions,
          'users:user-pep-status:write',
          'users:user-manual-risk-levels:write',
          'users:user-tags:write',
        ],
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
