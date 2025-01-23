import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const rolesService = new RoleService({
    auth0Domain,
  })

  const roles = await rolesService.getTenantRoles(tenant.id)
  for (const role of roles) {
    if (role.permissions.includes('case-management:case-overview:write')) {
      await rolesService.updateRolePermissions(role.id, [
        ...role.permissions,
        'case-management:case-assignment:write',
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
