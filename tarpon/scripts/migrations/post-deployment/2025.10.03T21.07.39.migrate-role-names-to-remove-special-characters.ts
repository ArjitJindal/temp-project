import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { RoleService } from '@/services/roles'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const auth0Domain = tenant.auth0Domain

  const roleService = new RoleService(
    { auth0Domain },
    { dynamoDb: null as any }
  )

  const tenantRoles = await roleService.getTenantRoles(tenantId)

  for (const role of tenantRoles) {
    const roleName = role.name
    const sanitizedRoleName = roleName.replace(/[^a-zA-Z0-9_ ]/g, ' ')
    if (roleName !== sanitizedRoleName) {
      console.log(
        `Migrating role "${tenantId}:${roleName}" to "${sanitizedRoleName}" for tenant ${tenantId}`
      )

      await roleService.updateRole(tenantId, role.id, {
        ...role,
        name: sanitizedRoleName,
      })

      console.log(
        `Migrated role "${tenantId}:${roleName}" to "${sanitizedRoleName}" for tenant ${tenantId} successfully`
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
