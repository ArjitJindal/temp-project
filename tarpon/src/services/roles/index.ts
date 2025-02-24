import { BadRequest, Conflict } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { memoize } from 'lodash'
import { AccountsService } from '../accounts'
import { Tenant } from '../accounts/repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { Auth0RolesRepository } from './repository/auth0'
import { DynamoRolesRepository } from './repository/dynamo'
import { isInNamespace, transformRole } from './utils'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import {
  auth0AsyncWrapper,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { traceable } from '@/core/xray'
import { CreateAccountRole } from '@/@types/openapi-internal/CreateAccountRole'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'

@traceable
export class RoleService {
  private config: { auth0Domain: string }
  private dynamoDb: DynamoDBDocumentClient
  public cache: DynamoRolesRepository
  public auth0: Auth0RolesRepository

  constructor(
    config: { auth0Domain: string },
    connections: { dynamoDb: DynamoDBDocumentClient }
  ) {
    this.config = config
    this.dynamoDb = connections.dynamoDb
    this.cache = new DynamoRolesRepository(
      this.config.auth0Domain,
      this.dynamoDb
    )
    this.auth0 = new Auth0RolesRepository(this.config.auth0Domain)
  }

  public static getInstance(
    dynamoDb: DynamoDBDocumentClient,
    auth0Domain?: string
  ) {
    const derivedAuth0Domain =
      auth0Domain ??
      getContext()?.auth0Domain ??
      (process.env.AUTH0_DOMAIN as string)

    return new RoleService({ auth0Domain: derivedAuth0Domain }, { dynamoDb })
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    const roles = await this.cache.getTenantRoles(tenantId)

    if (!roles?.length) {
      const roles = await this.auth0.getTenantRoles(tenantId)
      await sendBatchJobCommand({
        type: 'SYNC_AUTH0_DATA',
        tenantId: tenantId,
        parameters: {
          tenantIds: [tenantId],
          type: 'TENANT_IDS',
        },
      })

      return roles
    }
    return roles.map((r) => transformRole(r, r.permissions))
  }

  async createRole(
    tenantId: string,
    inputRole: CreateAccountRole
  ): Promise<AccountRole> {
    const data = await this.auth0.createRole(tenantId, {
      type: 'AUTH0',
      params: inputRole,
    })
    await this.cache.createRole(tenantId, {
      type: 'DATABASE',
      params: data,
    })
    return transformRole(data, data.permissions)
  }

  async updateRole(
    tenantId: string,
    id: string,
    inputRole: AccountRole
  ): Promise<void> {
    await this.auth0.updateRole(tenantId, id, inputRole)
    await this.cache.updateRole(tenantId, id, inputRole)
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = (await accountsService.getTenantById(tenantId)) as Tenant
    const users = await this.getUsersByRole(id, tenant)
    await Promise.all(
      users.map((u) =>
        accountsService.patchUser(tenant, u.id, { role: inputRole.name })
      )
    )
    return
  }

  private validateRoleDeletion(
    tenantId: string,
    role: Omit<AccountRole, 'permissions'>,
    users: Account[]
  ) {
    if (isInNamespace('default', role.name) || role.name == 'root') {
      throw new BadRequest(`Can't delete managed role`)
    }

    if (!isInNamespace(tenantId, role.name)) {
      throw new BadRequest(`Role not owned by ${tenantId}`)
    }

    if (users.length > 0) {
      throw new BadRequest(
        'Users must be migrated from this role before it can be deleted: ' +
          users.map((u) => u.email).join(', ')
      )
    }
  }

  async deleteRole(tenantId: string, id: string): Promise<void> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const role = await auth0AsyncWrapper(() => rolesManager.get({ id }))
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(tenantId)
    if (!tenant) {
      throw new BadRequest(`Tenant ${tenantId} not found`)
    }
    const users = await this.getUsersByRole(role.id, tenant)
    this.validateRoleDeletion(tenantId, role, users)

    await this.deleteRoleInternal(id)
  }

  private async deleteRoleInternal(id: string) {
    await this.cache.deleteRole(id)
    await this.auth0.deleteRole(id)
  }

  async getRole(roleId: string): Promise<AccountRole> {
    const cachedRole = await this.cache.getRole(roleId)
    if (!cachedRole) {
      const role = await this.auth0.getRole(roleId)
      await this.cache.createRole(roleId, {
        type: 'DATABASE',
        params: role,
      })
      return role
    }
    return transformRole(cachedRole, cachedRole.permissions)
  }

  async setRole(
    tenantId: string,
    userId: string,
    roleName: string
  ): Promise<void> {
    // Assign the role
    const tenantRoles = await this.getTenantRoles(tenantId)
    const role = tenantRoles.find((r) => r.name == roleName)
    if (role == undefined) {
      throw new Conflict(`"${roleName}" not valid for tenant`)
    }
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const roles = await auth0AsyncWrapper(() =>
      userManager.getRoles({ id: userId })
    )
    if (roles.length > 0) {
      await userManager.deleteRoles(
        { id: userId },
        { roles: roles.map((role) => role.id) }
      )
    }
    await userManager.assignRoles(
      { id: userId },
      { roles: [role.id as string] }
    )
    await this.updateUserRoleInAccounts(tenantId, userId, roleName)
  }

  private async updateUserRoleInAccounts(
    tenantId: string,
    userId: string,
    roleName: string
  ) {
    const accountsService = AccountsService.getInstance(this.dynamoDb)

    await accountsService.auth0.patchAccount(tenantId, userId, {
      role: roleName,
    })

    await accountsService.cache.patchAccount(tenantId, userId, {
      role: roleName,
    })
  }

  public getUsersByRole = memoize(async (id: string, tenant: Tenant) => {
    const users = await this.cache.getUsersByRole(id, tenant)

    if (!users?.length) {
      const data = await this.auth0.getUsersByRole(id, tenant)

      if (data?.length) {
        await sendBatchJobCommand({
          type: 'SYNC_AUTH0_DATA',
          tenantId: tenant.id,
          parameters: { tenantIds: [tenant.id], type: 'TENANT_IDS' },
        })
      }

      return data
    }
    return users
  })

  async updateRolePermissions(id: string, permissions: Permission[]) {
    await this.auth0.updateRolePermissions(id, permissions)
    await this.cache.updateRolePermissions(id, permissions)
  }
}
