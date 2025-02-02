import { migrateAllTenants } from '../utils/tenant'
import { RoleService } from '@/services/roles'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const dynamoDb = getDynamoDbClient()
  const rolesService = RoleService.getInstance(dynamoDb, auth0Domain)

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
