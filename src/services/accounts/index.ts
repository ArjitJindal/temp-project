import { v4 as uuidv4 } from 'uuid'
import { BadRequest, Conflict } from 'http-errors'
import {
  ManagementClient,
  Organization,
  User,
  AuthenticationClient,
} from 'auth0'
import { UserMetadata } from 'aws-sdk/clients/elastictranscoder'
import { AccountsConfig } from '../../lambdas/console-api-account/app'
import { Account as ApiAccount } from '@/@types/openapi-internal/Account'
import { AccountRoleName } from '@/@types/openapi-internal/AccountRoleName'
import { logger } from '@/core/logger'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { isValidAccountRoleName } from '@/@types/openapi-internal-custom/AccountRoleName'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'

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
  role: AccountRoleName
}

export type Account = ApiAccount

export type Tenant = {
  id: string
  name: string
  orgId: string
  apiAudience: string
  region: string
}

export class AccountsService {
  private authenticationClient: AuthenticationClient
  private config: AccountsConfig

  constructor(config: AccountsConfig) {
    this.config = config
    const options = {
      domain: config.AUTH0_DOMAIN,
    }
    this.authenticationClient = new AuthenticationClient(options)
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
      apiAudience: organization.metadata?.apiAudience,
      region: organization.metadata?.region,
    }
  }

  private static userToAccount(user: User<AppMetadata>): Account {
    const { app_metadata, user_id, email } = user
    if (user_id == null) {
      throw new Conflict('User id can not be null')
    }
    if (email == null) {
      throw new Conflict('User email can not be null')
    }
    const role: AccountRoleName =
      app_metadata && isValidAccountRoleName(app_metadata.role)
        ? app_metadata.role
        : 'user'
    return {
      id: user_id,
      role: role,
      email: email,
      emailVerified: user.email_verified ?? false,
      name: user.name ?? '',
      picture: user.picture,
    }
  }

  private async getAuth0Client() {
    const { clientId, clientSecret } = await getAuth0Credentials()
    return {
      domain: this.config.AUTH0_DOMAIN,
      clientId,
      clientSecret,
    }
  }

  async getManagementClient(): Promise<ManagementClient<AppMetadata>> {
    const options = await this.getAuth0Client()
    return new ManagementClient(options)
  }

  async getAuthenticationClient() {
    const options = await this.getAuth0Client()
    return new AuthenticationClient(options)
  }

  async getAccountTenant(userId: string): Promise<Tenant> {
    const managementClient = await this.getManagementClient()

    const usersManagement = getUsersManagement(managementClient)
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
      role: AccountRoleName
    }
  ): Promise<Account> {
    let user: User<AppMetadata, UserMetadata> | null = null
    let account: Account | null = null
    const managementClient: ManagementClient<AppMetadata> =
      await this.getManagementClient()

    const authenticationClient = await this.getAuthenticationClient()

    try {
      user = await managementClient.createUser({
        connection: CONNECTION_NAME,
        email: params.email,
        // NOTE: We need at least one upper case character
        password: `P-${uuidv4()}`,
        app_metadata: {
          role: params.role,
        },
        verify_email: false,
      })
      logger.info('Created user', {
        email: params.email,
      })
      account = AccountsService.userToAccount(user)
      await managementClient.organizations.addMembers(
        { id: tenant.orgId },
        {
          members: [account.id],
        }
      )
      logger.info(`Added user to orginization ${tenant.orgId}`, {
        email: params.email,
        account: account.id,
      })
    } catch (e) {
      if (user) {
        await managementClient.deleteUser({ id: user.user_id as string })
        logger.info('Deleted user', {
          email: params.email,
        })
      }
      throw e
    }

    await managementClient.sendEmailVerification({
      user_id: user.user_id as string,
      client_id: this.config.AUTH0_CONSOLE_CLIENT_ID,
    })
    logger.info(`Sent verification email`, {
      email: params.email,
    })
    await authenticationClient.requestChangePasswordEmail({
      client_id: this.config.AUTH0_CONSOLE_CLIENT_ID,
      connection: CONNECTION_NAME,
      email: params.email,
    })
    logger.info(`Sent password reset email`, {
      email: params.email,
    })
    return account
  }

  async getTenantAccounts(tenant: Tenant): Promise<Account[]> {
    const managementClient: ManagementClient<AppMetadata> =
      await this.getManagementClient()
    // todo: this call can only return up to 1000 users, need to handle this
    const members = await managementClient.organizations.getMembers({
      id: tenant.orgId,
      include_totals: false,
    })

    const ids = members.map((x) => x.user_id)

    // todo: this call support maximum 50 items per page, need to paginate
    const users = await managementClient.getUsers({
      q: `user_id:(${ids.map((id) => `"${id}"`).join(' OR ')})`,
    })

    return users.map(AccountsService.userToAccount)
  }
  async getAccount(id: string): Promise<Account> {
    const managementClient: ManagementClient<AppMetadata> =
      await this.getManagementClient()
    return AccountsService.userToAccount(await managementClient.getUser({ id }))
  }

  async getTenants(): Promise<Tenant[]> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    const organizations = await managementClient.organizations.getAll()
    return organizations.map(AccountsService.organizationToTenant)
  }

  async changeUserTenant(
    oldTenant: Tenant,
    newTenant: Tenant,
    userId: string
  ): Promise<void> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    await managementClient.organizations.removeMembers(
      { id: oldTenant.orgId },
      {
        members: [userId],
      }
    )
    // Need to do this call to make sure operations are executed in exact order.
    // Without it if you try to remove and add member from the same organization,
    // it will be removed but will not be added
    await managementClient.organizations.getMembers({
      id: newTenant.orgId,
    })
    await managementClient.organizations.addMembers(
      { id: newTenant.orgId },
      {
        members: [userId],
      }
    )
  }

  async deleteUser(tenant: Tenant, idToDelete: string): Promise<void> {
    const userTenant = await this.getAccountTenant(idToDelete)
    const managementClient = new ManagementClient(await this.getAuth0Client())

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${idToDelete}" in the tenant |${tenant.id}|`
      )
    }
    await managementClient.deleteUser({ id: idToDelete })
  }

  async patchUser(
    tenant: Tenant,
    accountId: string,
    patch: AccountPatchPayload
  ): Promise<Account> {
    const userTenant = await this.getAccountTenant(accountId)
    const managementClient: ManagementClient<AppMetadata> =
      await this.getManagementClient()

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${accountId}" in the tenant |${tenant.id}|`
      )
    }

    const user = await managementClient.getUser({
      id: accountId,
    })

    const patchedUser = await managementClient.updateUser(
      {
        id: accountId,
      },
      {
        app_metadata: {
          ...user.app_metadata,
          role: patch.role,
        },
      }
    )
    return AccountsService.userToAccount(patchedUser)
  }

  async getUserSettings(
    tenant: Tenant,
    accountId: string
  ): Promise<AccountSettings> {
    const managementClient = await this.getManagementClient()
    const user = await managementClient.getUser({
      id: accountId,
    })
    return {
      demoMode: user.user_metadata?.['demoMode'] === true,
    }
  }

  /**
   * @deprecated The role service setRole method should be used instead.
   */
  async patchUserSettings(
    tenant: Tenant,
    accountId: string,
    patch: Partial<AccountSettings>
  ): Promise<AccountSettings> {
    const managementClient = await this.getManagementClient()
    const user = await managementClient.getUser({
      id: accountId,
    })

    const updatedUser = await managementClient.updateUser(
      {
        id: accountId,
      },
      {
        user_metadata: {
          ...user.user_metadata,
          ...patch,
        },
      }
    )
    return updatedUser.user_metadata ?? {}
  }

  async createAuth0Organization(
    tenantData: TenantCreationRequest,
    tenantId: string
  ): Promise<Organization> {
    const managementClient = new ManagementClient(await this.getAuth0Client())

    const auth0Audience = process.env.AUTH0_AUDIENCE?.split('https://')[1]
    const regionPrefix =
      process.env.ENV === 'prod' ? `${process.env.REGION}-` : ''
    const organization = await managementClient.organizations.create({
      name: tenantData.tenantName.toLowerCase(),
      display_name: tenantData?.auth0DisplayName?.replace(/[^a-zA-Z0-9]/g, '_'),
      metadata: {
        tenantId,
        consoleApiUrl: `https://${regionPrefix}${auth0Audience}console`,
        apiAudience: process.env.AUTH0_AUDIENCE as unknown as string,
        region: process.env.REGION,
      },
    })

    if (organization.id == null) {
      throw new Error('Unable to create organization')
    }

    return organization
  }

  async getOrganization(tenantName: string): Promise<Organization | null> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    try {
      const organization = await managementClient.organizations.getByName({
        name: tenantName.toLowerCase(),
      })

      return organization
    } catch (e) {
      if ((e as Error & { statusCode: number })?.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  async createAccountInOrganizationMultiple(
    organization: Organization,
    emails: string[],
    role: AccountRoleName
  ): Promise<void> {
    const tenantId = organization.metadata?.tenantId

    if (tenantId == null) {
      throw new BadRequest('Unable to find tenant id in organization metadata')
    }

    for await (const email of emails) {
      await this.createAccountInOrganization(
        {
          id: tenantId as unknown as string,
          name: organization.name,
          orgId: organization.id,
          apiAudience: organization.metadata?.apiAudience,
          region: organization.metadata?.region,
        },
        { email, role }
      )
    }
  }

  async checkAuth0UserExistsMultiple(emails: string[]): Promise<boolean> {
    const managementClient = new ManagementClient(await this.getAuth0Client())
    try {
      const users = await managementClient.getUsers({
        q: `email:(${emails.join(' OR ')})`,
        fields: 'email',
        include_fields: true,
        per_page: 1,
      })

      if (users.length > 0) {
        return true
      }
    } catch (e) {
      if ((e as Error & { statusCode: number })?.statusCode === 404) {
        return false
      }
      throw e
    }

    return false
  }
}
