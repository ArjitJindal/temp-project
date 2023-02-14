import { ManagementClient, AuthenticationClient } from 'auth0'
import { BadRequest, Conflict } from 'http-errors'
import { AccountsConfig } from '../../lambdas/console-api-role/app'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { Permissions } from '@/@types/openapi-internal/Permissions'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { AccountRoleName } from '@/@types/openapi-internal/AccountRoleName'
import { isValidAccountRoleName } from '@/@types/openapi-internal-custom/AccountRoleName'

export class RoleService {
  private authenticationClient: AuthenticationClient
  private config: AccountsConfig

  constructor(config: AccountsConfig) {
    this.config = config
    const options = {
      domain: config.AUTH0_DOMAIN,
    }
    this.authenticationClient = new AuthenticationClient(options)
  }

  private async getAuth0Client() {
    const { clientId, clientSecret } = await getAuth0Credentials()
    return {
      domain: this.config.AUTH0_DOMAIN,
      clientId,
      clientSecret,
    }
  }

  async getTenantRoles(_tenantId: string): Promise<AccountRole[]> {
    // Prefixed so we don't return internal roles (ROOT, TENANT_ROOT) or tenant-scopes roles (in the future).
    return this.rolesByPrefix('default')
  }

  async getPermissions(roleId: string): Promise<Permissions> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    // Haven't implemented any error handling for a bad role ID since this is internal.
    const auth0Permissions = await managementClient.getPermissionsInRole({
      id: roleId,
      per_page: 100, // One day we may have roles with >100 permissions.
    })

    return {
      permissions: auth0Permissions
        .filter((p) => p.permission_name)
        .map((p) => p.permission_name) as Permission[],
    }
  }

  async rolesByPrefix(prefix: string): Promise<AccountRole[]> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const roles = await managementClient.getRoles({
      name_filter: `${prefix}:`,
    })
    // We store roles in the form namespace:role on Auth0. Default roles are stored in the "default" namespace.
    const validRoles = roles.filter(
      (r) => r.name && r.name.match(/^[0-9a-z]+:[0-9a-z]+$/)
    )
    return validRoles.map((role) => {
      if (role.name == undefined) {
        throw new Error('Role name cannot be null')
      }
      const [, roleName] = role.name.split(':')
      return {
        id: role.id,
        name: roleName as AccountRoleName,
      }
    })
  }
  async setRole(
    tenantId: string,
    userId: string,
    roleName: string
  ): Promise<void> {
    if (!isValidAccountRoleName(roleName)) {
      throw new BadRequest(`"${roleName}" is an invalid role`)
    }

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
