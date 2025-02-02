import { BadRequest, Conflict } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoRolesRepository } from './repository/dynamo'
import { Auth0RolesRepository } from './repository/auth0'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import {
  auth0AsyncWrapper,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { isValidManagedRoleName } from '@/@types/openapi-internal-custom/ManagedRoleName'
import { traceable } from '@/core/xray'
import { CreateAccountRole } from '@/@types/openapi-internal/CreateAccountRole'
import { getContext } from '@/core/utils/context'
import { isFlagrightInternalUser } from '@/@types/jwt'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { ACCOUNTS_COLLECTION } from '@/utils/mongodb-definitions'

@traceable
export class RoleService {
  private config: { auth0Domain: string }
  private dynamoDb: DynamoDBDocumentClient

  constructor(
    config: { auth0Domain: string },
    connections: { dynamoDb: DynamoDBDocumentClient }
  ) {
    this.config = config
    this.dynamoDb = connections.dynamoDb
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

  public cache() {
    return new DynamoRolesRepository(this.config.auth0Domain, this.dynamoDb)
  }

  public auth0() {
    return new Auth0RolesRepository(this.config.auth0Domain)
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    const isInternalUser =
      isFlagrightInternalUser() && getContext()?.user?.role === 'root'
    // Prefixed so we don't return internal roles (ROOT, TENANT_ROOT) or tenant-scopes roles (in the future).

    const promises: Promise<AccountRole[]>[] = [
      this.rolesByNamespace('default'),
      this.rolesByNamespace(tenantId),
    ]

    const roles = await Promise.all(promises)

    if (isInternalUser) {
      const rootRole = await this.getRolesByName('root')
      roles.push(rootRole)
    }

    return roles.flat()
  }
  async createRole(
    tenantId: string,
    inputRole: CreateAccountRole
  ): Promise<AccountRole> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    if (isValidManagedRoleName(inputRole.name?.toLowerCase())) {
      throw new BadRequest(
        "Can't overwrite managed role, please choose a different name."
      )
    }
    const role = await auth0AsyncWrapper(() =>
      rolesManager.create({
        name: getNamespacedRoleName(tenantId, inputRole.name),
        description: inputRole.description,
      })
    )

    if (inputRole.permissions && inputRole.permissions?.length > 0) {
      await rolesManager.addPermissions(
        { id: role.id as string },
        {
          permissions:
            inputRole.permissions?.map((permission_name) => ({
              permission_name,
              resource_server_identifier: process.env.AUTH0_AUDIENCE as string,
            })) || [],
        }
      )
    }

    if (!role.id) {
      throw new Error('Role ID cannot be null')
    }

    return { ...inputRole, id: role.id }
  }

  public async getRolesByName(name: string): Promise<AccountRole[]> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const roles = await auth0AsyncWrapper(() =>
      rolesManager.getAll({ name_filter: name })
    )

    return await Promise.all(
      roles.map(async (r) => {
        const roleDetails = await this.getRole(r.id as string)
        return {
          ...roleDetails,
          name: r.name,
          description: r.description,
        }
      })
    )
  }

  async updateRole(
    tenantId: string,
    id: string,
    inputRole: AccountRole
  ): Promise<void> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const userManager = managementClient.users
    if (isValidManagedRoleName(inputRole.name?.toLowerCase())) {
      throw new BadRequest(
        "Can't overwrite default role, please choose a different name."
      )
    }
    await rolesManager.update(
      { id },
      {
        name: getNamespacedRoleName(tenantId, inputRole.name),
        description: inputRole.description,
      }
    )

    await this.updateRolePermissions(id, inputRole.permissions || [])

    const users = await this.getUsersByRole(inputRole.id ?? '')
    await Promise.all(
      users.map((u) => {
        return userManager.update(
          { id: u.user_id as string },
          { app_metadata: { ...u.app_metadata, role: inputRole.name } }
        )
      })
    )
    return
  }

  async deleteRole(tenantId: string, id: string): Promise<void> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const role = await auth0AsyncWrapper(() => rolesManager.get({ id }))

    const users = await this.getUsersByRole(role.id ?? '')
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
    await rolesManager.delete({ id })
  }

  async getRole(roleId: string): Promise<AccountRole> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const role = await auth0AsyncWrapper(() => rolesManager.get({ id: roleId }))

    // Haven't implemented any error handling for a bad role ID since this is internal.
    const auth0Permissions = await auth0AsyncWrapper(() =>
      rolesManager.getPermissions({
        id: roleId,
        per_page: 100, // One day we may have roles with >100 permissions.
      })
    )

    if (!role.id) {
      throw new Error('Role ID cannot be null')
    }

    return {
      id: role.id,
      name: getRoleDisplayName(role.name) || 'No name.',
      description: role.description || 'No description.',
      permissions: auth0Permissions
        .filter((p) => p.permission_name)
        .map((p) => p.permission_name) as Permission[],
    }
  }

  private async rolesByNamespace(namespace: string) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const roles = await auth0AsyncWrapper(() =>
      rolesManager.getAll({
        name_filter: `${namespace}:`,
      })
    )
    // We store roles in the form namespace:role on Auth0. Default roles are stored in the "default" namespace.
    const validRoles = roles.filter(
      (r) => r.name && r.name.match(/^[0-9a-z-_]+:.+$/i)
    )

    return await Promise.all(
      validRoles.map((role) => {
        if (role.name == undefined) {
          throw new Error('Role name cannot be null')
        }

        const roleId = role.id
        if (!roleId) {
          throw new Error('Role ID cannot be null')
        }

        return this.getRole(roleId)
      })
    )
  }

  public async updateRolePermissions(
    id: string,
    inputPermissions: Permission[]
  ) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const rolesManager = managementClient.roles
    const currentPermissions = await auth0AsyncWrapper(() =>
      rolesManager.getPermissions({
        id,
      })
    )
    if (currentPermissions.length > 0) {
      await rolesManager.deletePermissions(
        { id },
        {
          permissions: currentPermissions.map((p) => ({
            resource_server_identifier: p.resource_server_identifier as string,
            permission_name: p.permission_name as string,
          })),
        }
      )
    }
    if (inputPermissions && inputPermissions?.length > 0) {
      await rolesManager.addPermissions(
        { id },
        {
          permissions:
            inputPermissions?.map((permission_name) => ({
              permission_name,
              resource_server_identifier: process.env.AUTH0_AUDIENCE as string,
            })) || [],
        }
      )
    }
  }

  async getUsersByRole(id: string, tenandId?: string) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const rolesManager = managementClient.roles
    const usersByRole =
      id && (await auth0AsyncWrapper(() => rolesManager.getUsers({ id })))
    if (usersByRole) {
      const users = await Promise.all(
        usersByRole.map((u) =>
          auth0AsyncWrapper(() => userManager.get({ id: u.user_id as string }))
        )
      )
      if (tenandId) {
        const db = await getMongoDbClientDb()
        const accounts = await db
          .collection(ACCOUNTS_COLLECTION(tenandId))
          .find({
            role: id,
          })
          .toArray()
        return accounts.filter((account) =>
          users.find((user) => user.user_id === account.id)
        )
      }
      return users
    }
    return []
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

    // Set app metadata
    const user = await auth0AsyncWrapper(() => userManager.get({ id: userId }))
    await userManager.update(
      { id: userId },
      { app_metadata: { ...user.app_metadata, role: roleName } }
    )
  }
}

function getNamespacedRoleName(namespace: string, roleName?: string) {
  return `${namespace}:${roleName}`
}

function getRoleDisplayName(roleName?: string) {
  if (roleName == 'root') {
    return 'root'
  }
  if (roleName == 'whitelabel-root') {
    return 'whitelabel-root'
  }
  return roleName && roleName.split(':')[1]
}

function isInNamespace(namespace: string, roleName?: string) {
  return roleName?.startsWith(`${namespace}:`)
}
