import { BadRequest, Conflict } from 'http-errors'
import { ManagementClient, Organization, User } from 'auth0'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import { JwtRole } from '@/@types/jwt'
import { Account as ApiAccount } from '@/@types/openapi-internal/Account'

// Current TS typings for auth0  (@types/auth0@2.35.0) are outdated and
// doesn't have definitions for users management api. Hope they will fix it soon
// todo: get rid of this when types updated
function getUsersManagement(managementClient: ManagementClient): {
  getUserOrganizations(params: { id: string }): Promise<Organization[]>
} {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return managementClient.users as any
}

// todo: move to config?
const CONNECTION_NAME = 'Username-Password-Authentication'

export interface AppMetadata {
  role: JwtRole
}

export type Account = ApiAccount

export type Tenant = {
  id: string
  name: string
  orgId: string
}

export class AccountsService {
  private managementClient: ManagementClient<AppMetadata>

  constructor(config: AccountsConfig) {
    this.managementClient = new ManagementClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
    })
  }

  private static organizationToTenant(organization: Organization): Tenant {
    const tenantId = organization.metadata.tenantId
    if (tenantId == null) {
      throw new Conflict('Invalid organization metadata, tenantId expected')
    }
    return {
      id: tenantId,
      name: organization.display_name || tenantId,
      orgId: organization.id,
    }
  }

  private static userToAccount(user: User<AppMetadata>): Account {
    if (user.user_id == null) {
      throw new Conflict('User id can not be null')
    }
    if (user.email == null) {
      throw new Conflict('User email can not be null')
    }
    return {
      id: user.user_id,
      role: user.app_metadata?.role ?? 'USER',
      email: user.email,
      emailVerified: user.email_verified ?? false,
      picture: user.picture,
    }
  }

  async getAccountTenant(userId: string): Promise<Tenant> {
    const usersManagement = getUsersManagement(this.managementClient)
    const organizations = await usersManagement.getUserOrganizations({
      id: userId,
    })
    if (organizations.length > 1) {
      throw new Conflict('User can be a member of only one tenant')
    }
    const [organization] = organizations
    if (organization == null) {
      throw new Conflict('User suppose to be a member of tenant organization')
    }
    return AccountsService.organizationToTenant(organization)
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const allTenants = await this.getTenants()
    return allTenants.find((tenant) => tenant.id === tenantId) ?? null
  }

  async createAccountInOrganization(
    tenant: Tenant,
    params: {
      email: string
      password: string
      role: JwtRole
    }
  ): Promise<Account> {
    const user = await this.managementClient.createUser({
      connection: CONNECTION_NAME,
      email: params.email,
      password: params.password,
      app_metadata: {
        role: params.role,
      },
    })
    const account = AccountsService.userToAccount(user)
    await this.managementClient.organizations.addMembers(
      { id: tenant.orgId },
      {
        members: [account.id],
      }
    )
    return account
  }

  async getTenantAccounts(tenant: Tenant): Promise<Account[]> {
    // todo: this call can only return up to 1000 users, need to handle this
    const members = await this.managementClient.organizations.getMembers({
      id: tenant.orgId,
      include_totals: false,
    })

    const ids = members.map((x) => x.user_id)

    // todo: this call support maximum 50 items per page, need to paginate
    const users = await this.managementClient.getUsers({
      q: `user_id:(${ids.map((id) => `"${id}"`).join(' OR ')})`,
    })

    return users.map(AccountsService.userToAccount)
  }

  async getTenants(): Promise<Tenant[]> {
    const organizations = await this.managementClient.organizations.getAll()
    return organizations.map(AccountsService.organizationToTenant)
  }

  async changeUserTenant(
    oldTenant: Tenant,
    newTenant: Tenant,
    userId: string
  ): Promise<void> {
    await this.managementClient.organizations.removeMembers(
      { id: oldTenant.orgId },
      {
        members: [userId],
      }
    )
    // Need to do this call to make sure operations are executed in exact order.
    // Without it if you try to remove and add member from the same organization,
    // it will be removed but will not be added
    await this.managementClient.organizations.getMembers({
      id: newTenant.orgId,
    })
    await this.managementClient.organizations.addMembers(
      { id: newTenant.orgId },
      {
        members: [userId],
      }
    )
  }

  async deleteUser(tenant: Tenant, idToDelete: string): Promise<void> {
    const userTenant = await this.getAccountTenant(idToDelete)

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${idToDelete}" in the tenant |${tenant.id}|`
      )
    }
    await this.managementClient.deleteUser({ id: idToDelete })
  }
}
