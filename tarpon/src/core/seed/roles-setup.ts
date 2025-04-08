import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import pMap from 'p-map'
import { ManagementApiError } from 'auth0'
import { getContext } from '../utils/context-storage'
import { Account } from '@/@types/openapi-internal/Account'
import { RoleService } from '@/services/roles'
import { getNonDemoTenantId } from '@/utils/tenant'

export async function removeDemoRoles(
  tenantId: string,
  tenantAccount: Account[],
  dynamoDb: DynamoDBDocumentClient
) {
  const originalTenantId = getNonDemoTenantId(tenantId)
  const auth0Domain =
    getContext()?.auth0Domain ?? (process.env.AUTH0_DOMAIN as string)
  const roleService = new RoleService({ auth0Domain }, { dynamoDb })
  const tenantRoles = await roleService.getTenantRoles(originalTenantId)
  const tenantDemoRoles = tenantRoles.filter((role) =>
    role.name.includes('demo-')
  )
  // creating a map for roles for faster lookup
  const rolesMap = new Map<string, number>()
  tenantDemoRoles.forEach((role) => rolesMap.set(role.name, 1))
  // all account with demo roles are now shifted to analyst role
  const analystRoleName = 'analyst'
  const accountIdToUpdate: string[] = []
  for (let i = 0; i < tenantAccount.length; i++) {
    const account = tenantAccount[i]
    if (rolesMap.has(account.role)) {
      accountIdToUpdate.push(account.id)
    }
  }
  const tenantDemoRolesId = tenantDemoRoles.map((role) => role.id)
  console.log(tenantDemoRolesId, accountIdToUpdate)

  await pMap(
    accountIdToUpdate,
    async (id) =>
      await roleService.setRole(originalTenantId, id, analystRoleName),
    { concurrency: 5 }
  )

  await pMap(
    tenantDemoRolesId,
    async (id) => {
      try {
        await roleService.deleteRole(originalTenantId, id)
      } catch (error) {
        // error while deleting from auth 0
        if (
          error instanceof ManagementApiError &&
          error?.statusCode == 404 &&
          error?.message === 'The role does not exist.'
        ) {
          console.warn(`Failed to delete role ${id}:`, error)
          return
        }
        throw error
      }
    },
    { concurrency: 5 }
  )
}
