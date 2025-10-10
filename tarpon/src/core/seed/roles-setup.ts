import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import pMap from 'p-map'
import { ManagementApiError } from 'auth0'
import { getContext } from '../utils/context-storage'
import { Account } from '@/@types/openapi-internal/Account'
import { RoleService } from '@/services/roles'
import { getNonDemoTenantId } from '@/utils/tenant-id'
import { MicroTenantInfo } from '@/@types/tenant'

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
  const accountToUpdate: (MicroTenantInfo & { id: string })[] = []

  for (let i = 0; i < tenantAccount.length; i++) {
    const account = tenantAccount[i]
    if (rolesMap.has(account.role)) {
      accountToUpdate.push({
        id: account.id,
        tenantId: account.tenantId,
        orgName: account.orgName,
      })
    }
  }
  const tenantDemoRolesId = tenantDemoRoles.map((role) => role.id)

  await pMap(
    accountToUpdate,
    async (account) => {
      await roleService.setRole(
        { tenantId: account.tenantId, orgName: account.orgName },
        account.id,
        analystRoleName
      )
    },
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
