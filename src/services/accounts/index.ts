import { v4 as uuidv4 } from 'uuid'
import { BadRequest, Conflict } from 'http-errors'
import {
  ManagementClient,
  Organization,
  User,
  AuthenticationClient,
} from 'auth0'
import { UserMetadata } from 'aws-sdk/clients/elastictranscoder'
import { MongoClient } from 'mongodb'
import { Account as ApiAccount } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import { getAuth0Credentials } from '@/utils/auth0-utils'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { RoleService } from '@/services/roles'
import { ACCOUNTS_COLLECTION } from '@/utils/mongoDBUtils'

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
  role: string
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
  private config: { auth0Domain: string }
  private mongoDb: MongoClient

  constructor(
    config: { auth0Domain: string },
    connections: { mongoDb?: MongoClient }
  ) {
    this.config = config
    this.mongoDb = connections.mongoDb as MongoClient
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
    const role: string = app_metadata ? app_metadata.role : 'user'
    return {
      id: user_id,
      role: role,
      email: email,
      emailVerified: user.email_verified ?? false,
      name: user.name ?? '',
      picture: user.picture,
      blocked: user.blocked ?? false,
    }
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
      role: string
    }
  ): Promise<Account> {
    let user: User<AppMetadata, UserMetadata> | null = null
    let account: Account | null = null
    const managementClient: ManagementClient<AppMetadata> =
      await this.getManagementClient()

    const roleService = new RoleService({
      auth0Domain: this.config.auth0Domain,
    })

    const authenticationClient = await this.getAuthenticationClient()

    try {
      const existingUser = await managementClient.getUsers({
        q: `email:"${params.email}"`,
        per_page: 1,
        fields: 'user_id,blocked',
      })

      /* Temporary workaround for adding again blocked user to organization need to be removed after unblock user flow will be implemented */
      if (existingUser.length > 0 && existingUser[0].blocked) {
        user = await managementClient.updateUser(
          {
            id: existingUser[0].user_id as string,
          },
          { blocked: false }
        )
      } else {
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
        await roleService.setRole(
          tenant.id,
          user.user_id as string,
          params.role
        )
      }
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
      await this.insertAuth0UserToMongo(tenant.id, [account])
    } catch (e) {
      if (user) {
        await managementClient.deleteUser({ id: user.user_id as string })
        logger.info('Deleted user', {
          email: params.email,
        })
      }
      throw e
    }

    const consoleClient = (
      await managementClient.getClients({ app_type: ['spa'] })
    ).filter((client) => client.client_metadata?.isConsole)[0]
    if (!consoleClient) {
      throw new Error('Cannot find Auth0 Console client!')
    }

    await managementClient.sendEmailVerification({
      user_id: user.user_id as string,
      client_id: consoleClient.client_id,
    })
    logger.info(`Sent verification email`, {
      email: params.email,
    })
    await authenticationClient.requestChangePasswordEmail({
      client_id: consoleClient.client_id,
      connection: CONNECTION_NAME,
      email: params.email,
    })
    logger.info(`Sent password reset email`, {
      email: params.email,
    })
    return account
  }

  public async insertAuth0UserToMongo(tenantId: string, users: Account[]) {
    const db = this.mongoDb.db()
    await Promise.all(
      users.map((user) =>
        db
          .collection<Account>(ACCOUNTS_COLLECTION(tenantId))
          .updateOne({ id: user.id }, { $set: user }, { upsert: true })
      )
    )
  }

  private async deleteAuth0UserFromMongo(tenantId: string, userId: string) {
    const db = this.mongoDb.db()
    await db
      .collection<Account>(ACCOUNTS_COLLECTION(tenantId))
      .deleteOne({ id: userId })
  }

  private async updateAuth0UserInMongo(
    tenantId: string,
    userId: string,
    data: Partial<Account>
  ) {
    const db = this.mongoDb.db()
    await db
      .collection<Account>(ACCOUNTS_COLLECTION(tenantId))
      .updateOne({ id: userId }, { $set: data })
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

    if (ids.length == 0) {
      return []
    }

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
    const user = await this.getAccount(userId)
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

    await this.deleteAuth0UserFromMongo(oldTenant.id, userId)

    if (user) {
      await this.insertAuth0UserToMongo(newTenant.id, [user])
    }
  }

  async deleteUser(tenant: Tenant, idToDelete: string): Promise<void> {
    const userTenant = await this.getAccountTenant(idToDelete)
    const managementClient = new ManagementClient(await this.getAuth0Client())

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${idToDelete}" in the tenant |${tenant.id}|`
      )
    }
    await managementClient.updateUser({ id: idToDelete }, { blocked: true })

    await this.updateAuth0UserInMongo(tenant.id, idToDelete, {
      blocked: true,
    })
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

    await this.updateAuth0UserInMongo(tenant.id, accountId, {
      role: patch.role,
    })

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
    role: string
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

    const allAccounts = await this.getTenantAccounts({
      id: tenantId as unknown as string,
      name: organization.name,
      orgId: organization.id,
      apiAudience: organization.metadata?.apiAudience as unknown as string,
      region: organization.metadata?.region as unknown as string,
    })

    await this.insertAuth0UserToMongo(
      tenantId as unknown as string,
      allAccounts
    )
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
