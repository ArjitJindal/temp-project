import { ManagementClient, AuthenticationClient } from 'auth0'
import { AccountsConfig } from '../app'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { Permissions } from '@/@types/openapi-internal/Permissions'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { AccountRoleName } from '@/@types/openapi-internal/AccountRoleName'

export class RolesService {
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

  async getRoles(): Promise<AccountRole[]> {
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
}
