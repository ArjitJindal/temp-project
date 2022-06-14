import { BadRequest, Conflict } from 'http-errors'
import { ManagementClient, Organization, User } from 'auth0'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import { assertRole, JwtRole } from '@/@types/jwt'

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

export type Account = User<AppMetadata>

export class AccountsService {
  private managementClient: ManagementClient<AppMetadata>

  constructor(config: AccountsConfig) {
    this.managementClient = new ManagementClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
    })
  }

  async getUserOrganization(userId: string): Promise<Organization> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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
    return organization
  }

  async createUserInOrganization(
    organization: Organization,
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
    await this.managementClient.organizations.addMembers(organization, {
      members: [user.user_id as string],
    })
    return user
  }

  async getOrganizationAccounts(
    organization: Organization
  ): Promise<Account[]> {
    // todo: this call can only return up to 1000 users, need to handle this
    const members = await this.managementClient.organizations.getMembers({
      id: organization.id,
      include_totals: false,
    })

    const ids = members.map((x) => x.user_id)

    // todo: this call support maximum 50 items per page, need to paginate
    const users = await this.managementClient.getUsers({
      q: `user_id:(${ids.map((id) => `"${id}"`).join(' OR ')})`,
    })

    return users
  }

  async deleteUser(
    organization: Organization,
    idToDelete: string
  ): Promise<void> {
    const userOrganization = await this.getUserOrganization(idToDelete)

    if (userOrganization == null || userOrganization.id !== organization.id) {
      throw new BadRequest(
        `Unable to find user "${idToDelete}" in the tenant |${organization.id}|`
      )
    }
    await this.managementClient.deleteUser({ id: idToDelete })
  }
}
