import { BadRequest } from 'http-errors'
import { compact } from 'lodash'
import {
  getNamespacedRoleName,
  getRoleDisplayName,
  transformRole,
} from '../utils'
import { BaseRolesRepository, CreateRoleInternal, DEFAULT_NAMESPACE } from '.'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import {
  getAuth0ManagementClient,
  auth0AsyncWrapper,
} from '@/utils/auth0-utils'
import { isValidManagedRoleName } from '@/@types/openapi-internal-custom/ManagedRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { traceable } from '@/core/xray'
import { Auth0AccountsRepository } from '@/services/accounts/repository/auth0'
import { Tenant } from '@/services/accounts/repository'

@traceable
export class Auth0RolesRepository extends BaseRolesRepository {
  private auth0Domain: string

  constructor(auth0Domain: string) {
    super()
    this.auth0Domain = auth0Domain
  }

  async getRole(roleId: string): Promise<AccountRole> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
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

    return transformRole(
      role,
      auth0Permissions.map((p) => p.permission_name) as Permission[]
    )
  }

  async createRole(
    tenantId: string,
    params: CreateRoleInternal
  ): Promise<AccountRole> {
    if (params.type !== 'AUTH0') {
      throw new Error('Invalid role type')
    }
    const inputRole = params.params
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
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

    return { ...inputRole, id: role.id, name: role.name }
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    const promises: Promise<AccountRole[]>[] = [
      this.rolesByNamespace(DEFAULT_NAMESPACE),
      this.rolesByNamespace(tenantId),
    ]

    const roles = await Promise.all(promises)

    if (this.shouldFetchRootRole()) {
      const rootRole = await this.getRolesByName('root')
      const whitelabelRootRole = await this.getRolesByName('whitelabel-root')

      roles.push(compact([rootRole, whitelabelRootRole]))
    }

    console.log('roles', JSON.stringify(roles, null, 2))

    return roles.flat()
  }

  public async getRolesByName(name: string) {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const rolesManager = managementClient.roles
    const roles = await auth0AsyncWrapper(() =>
      rolesManager.getAll({ name_filter: name })
    )
    const role = roles.find((r) => r.name === name)
    if (!role) {
      throw new Error(`Role ${name} not found`)
    }
    return this.getRole(role.id as string)
  }

  public async rolesByNamespace(namespace: string) {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
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

  public async updateRole(
    tenantId: string,
    id: string,
    inputRole: AccountRole
  ) {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const rolesManager = managementClient.roles
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
  }

  public async updateRolePermissions(
    id: string,
    inputPermissions: Permission[]
  ) {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const rolesManager = managementClient.roles
    const currentPermissions = await auth0AsyncWrapper(() =>
      rolesManager.getPermissions({ id })
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

  public async deleteRole(id: string) {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const rolesManager = managementClient.roles
    await rolesManager.delete({ id })
  }

  public async getUsersByRole(id: string, tenant: Tenant) {
    const accountsService = new Auth0AccountsRepository(this.auth0Domain)
    const accounts = await accountsService.getTenantAccounts(tenant)
    const role = await this.getRole(id)
    if (!role) {
      throw new Error('Role not found')
    }
    const roleName = getRoleDisplayName(role.name)
    return accounts.filter((account) => account.role === roleName)
  }
}
