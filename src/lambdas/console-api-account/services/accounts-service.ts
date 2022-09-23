import { v4 as uuidv4 } from 'uuid'
import { BadRequest, Conflict } from 'http-errors'
import {
  ManagementClient,
  Organization,
  User,
  AuthenticationClient,
} from 'auth0'
import { UserMetadata } from 'aws-sdk/clients/elastictranscoder'
import { AccountsConfig } from '../app'
import { Account as ApiAccount } from '@/@types/openapi-internal/Account'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { logger } from '@/core/logger'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { isValidRole } from '@/@types/jwt'

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
  role: AccountRole
}

export type Account = ApiAccount

export type Tenant = {
  id: string
  name: string
  orgId: string
  apiAudience: string
}

export class AccountsService {
  private authenticationClient: AuthenticationClient
  private managementClient: ManagementClient<AppMetadata>
  private config: AccountsConfig

  constructor(config: AccountsConfig) {
    this.config = config
    const options = {
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
    }
    this.authenticationClient = new AuthenticationClient(options)
    this.managementClient = new ManagementClient(options)
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
    const role: AccountRole =
      app_metadata && isValidRole(app_metadata.role)
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
      role: AccountRole
    }
  ): Promise<Account> {
    let user: User<AppMetadata, UserMetadata> | null = null
    let account: Account | null = null
    try {
      user = await this.managementClient.createUser({
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
      await this.managementClient.organizations.addMembers(
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
        await this.managementClient.deleteUser({ id: user.user_id as string })
        logger.info('Deleted user', {
          email: params.email,
        })
      }
      throw e
    }

    await this.managementClient.sendEmailVerification({
      user_id: user.user_id as string,
      client_id: this.config.AUTH0_CONSOLE_CLIENT_ID,
    })
    logger.info(`Sent verification email`, {
      email: params.email,
    })
    await this.authenticationClient.requestChangePasswordEmail({
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

  async patchUser(
    tenant: Tenant,
    accountId: string,
    patch: AccountPatchPayload
  ): Promise<Account> {
    const userTenant = await this.getAccountTenant(accountId)

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${accountId}" in the tenant |${tenant.id}|`
      )
    }

    const user = await this.managementClient.getUser({
      id: accountId,
    })

    const patchedUser = await this.managementClient.updateUser(
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
}
