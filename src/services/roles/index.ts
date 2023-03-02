import { ManagementClient, AuthenticationClient } from 'auth0'
import { BadRequest, Conflict } from 'http-errors'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { isValidManagedRoleName } from '@/@types/openapi-internal-custom/ManagedRoleName'

export class RoleService {
  private authenticationClient: AuthenticationClient
  private config: { auth0Domain: string }

  constructor(config: { auth0Domain: string }) {
    this.config = config
    const options = {
      domain: config.auth0Domain,
    }
    this.authenticationClient = new AuthenticationClient(options)
  }

  private async getAuth0Client() {
    const { clientId, clientSecret } = await getAuth0Credentials(
      this.config.auth0Domain
    )
    return {
      domain: this.config.auth0Domain,
      clientId,
      clientSecret,
    }
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    // Prefixed so we don't return internal roles (ROOT, TENANT_ROOT) or tenant-scopes roles (in the future).
    const defaultRoles = await this.rolesByNamespace('default')
    const tenantRoles = await this.rolesByNamespace(tenantId)

    // We don't return permissions in this call due to latency.
    return defaultRoles.concat(tenantRoles)
  }
  async createRole(
    tenantId: string,
    inputRole: AccountRole
  ): Promise<AccountRole> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    if (isValidManagedRoleName(inputRole.name?.toLowerCase())) {
      throw new BadRequest(
        "Can't overwrite managed role, please choose a different name."
      )
    }
    const role = await managementClient.createRole({
      name: getNamespacedRoleName(tenantId, inputRole.name),
      description: inputRole.description,
    })

    if (inputRole.permissions && inputRole.permissions?.length > 0) {
      await managementClient.addPermissionsInRole(
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

    return { id: role.id, ...inputRole }
  }

  async updateRole(
    tenantId: string,
    id: string,
    inputRole: AccountRole
  ): Promise<AccountRole> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    if (isValidManagedRoleName(inputRole.name?.toLowerCase())) {
      throw new BadRequest(
        "Can't overwrite default role, please choose a different name."
      )
    }
    await managementClient.updateRole(
      { id },
      {
        name: getNamespacedRoleName(tenantId, inputRole.name),
        description: inputRole.description,
      }
    )

    await this.updateRolePermissions(id, inputRole.permissions || [])

    const users = await managementClient.getUsersInRole({
      id,
    })
    await Promise.all(
      users.map((u) => {
        return managementClient.updateUser(
          {
            id: u.user_id as string,
          },
          {
            app_metadata: {
              ...u.app_metadata,
              role: inputRole.name,
            },
          }
        )
      })
    )
    return { id, ...inputRole }
  }

  async deleteRole(tenantId: string, id: string): Promise<void> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const users = await managementClient.getUsersInRole({
      id,
    })

    const role = await managementClient.getRole({ id })
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
    await managementClient.deleteRole({ id })
  }

  async getRole(roleId: string): Promise<AccountRole> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const role = await managementClient.getRole({ id: roleId })

    // Haven't implemented any error handling for a bad role ID since this is internal.
    const auth0Permissions = await managementClient.getPermissionsInRole({
      id: roleId,
      per_page: 100, // One day we may have roles with >100 permissions.
    })

    return {
      id: role.id,
      name: getRoleDisplayName(role.name),
      description: role.description || 'No description.',
      permissions: auth0Permissions
        .filter((p) => p.permission_name)
        .map((p) => p.permission_name) as Permission[],
    }
  }

  private async rolesByNamespace(namespace: string): Promise<AccountRole[]> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const roles = await managementClient.getRoles({
      name_filter: `${namespace}:`,
    })
    // We store roles in the form namespace:role on Auth0. Default roles are stored in the "default" namespace.
    const validRoles = roles.filter(
      (r) => r.name && r.name.match(/^[0-9a-z]+:.+$/)
    )
    return validRoles.map((role) => {
      if (role.name == undefined) {
        throw new Error('Role name cannot be null')
      }

      return {
        id: role.id,
        name: getRoleDisplayName(role.name),
        description: !role.description ? 'No description.' : role.description,
      }
    })
  }

  private async updateRolePermissions(
    id: string,
    inputPermissions: Permission[]
  ) {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const currentPermissions = await managementClient.getPermissionsInRole({
      id,
    })
    if (currentPermissions.length > 0) {
      await managementClient.removePermissionsFromRole(
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
      await managementClient.addPermissionsInRole(
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
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const roles = await managementClient.getUserRoles({ id: userId })
    if (roles.length > 0) {
      await managementClient.removeRolesFromUser(
        { id: userId },
        { roles: roles.map((r) => r.id as string) }
      )
    }
    await managementClient.assignRolestoUser(
      { id: userId },
      { roles: [role.id as string] }
    )

    // Set app metadata
    const user = await managementClient.getUser({ id: userId })
    await managementClient.updateUser(
      {
        id: userId,
      },
      {
        app_metadata: {
          ...user.app_metadata,
          role: roleName,
        },
      }
    )
  }
}

function getNamespacedRoleName(namespace: string, roleName?: string) {
  return `${namespace}:${roleName}`
}

function getRoleDisplayName(roleName?: string) {
  return roleName && roleName.split(':')[1]
}

function isInNamespace(namespace: string, roleName?: string) {
  return roleName?.startsWith(`${namespace}:`)
}
