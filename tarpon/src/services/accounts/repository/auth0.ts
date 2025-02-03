import { GetOrganizations200ResponseOneOfInner } from 'auth0'
import * as createHttpError from 'http-errors'
import {
  Auth0TenantMetadata,
  BaseAccountsRepository,
  InternalAccountCreate,
  InternalOrganizationCreate,
  PatchAccountData,
  Tenant,
} from '.'
import {
  AppMetadata,
  auth0AsyncWrapper,
  CONNECTION_NAME,
  generateRandomPassword,
  getAuth0ManagementClient,
  organizationToTenant,
  userToAccount,
} from '@/utils/auth0-utils'
import { Account } from '@/@types/openapi-internal/Account'
import { getContext } from '@/core/utils/context'
import { envIsNot } from '@/utils/env'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'

@traceable
export class Auth0AccountsRepository extends BaseAccountsRepository {
  private readonly auth0Domain: string

  constructor(auth0Domain: string) {
    super()
    this.auth0Domain = auth0Domain
  }

  async deleteOrganization(tenant: Tenant): Promise<void> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations
    await organizationManager.delete({ id: tenant.orgId })
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users
    try {
      const user = await userManager.get({ id: accountId })
      return userToAccount(user.data)
    } catch (error) {
      // Gracefully handle user not found - Kavish
      logger.warn(`Error fetching account ${accountId} from Auth0: ${error}`)
      return null
    }
  }

  async getAccountByEmail(email: string): Promise<Account | null> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users
    const users = await auth0AsyncWrapper(() =>
      userManager.getAll({ q: `email:(${email})`, per_page: 1 })
    )

    return users.map(userToAccount)[0] ?? null
  }

  async getOrganization(
    _tenantId: string,
    userId?: string
  ): Promise<Tenant | null> {
    if (!userId) {
      throw new createHttpError.BadRequest('User id is required')
    }

    const managementClient = await getAuth0ManagementClient(this.auth0Domain)

    const usersManagement = managementClient.users
    const organizations: GetOrganizations200ResponseOneOfInner[] =
      await auth0AsyncWrapper(() =>
        usersManagement.getUserOrganizations({ id: userId })
      )
    if (organizations.length > 1) {
      throw new createHttpError.Conflict(
        'User can be a member of only one tenant'
      )
    }
    const [organization] = organizations
    if (organization == null) {
      throw new createHttpError.Conflict(
        'User suppose to be a member of tenant organization'
      )
    }

    return organizationToTenant(organization)
  }

  async unblockAccount(accountId: string): Promise<Account> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users

    const user = await auth0AsyncWrapper(() =>
      userManager.update(
        { id: accountId },
        { blocked: false, app_metadata: { blockedReason: null } }
      )
    )

    return userToAccount(user)
  }

  async getAccountTenant(userId: string): Promise<Tenant> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)

    const usersManagement = managementClient.users
    const organizations: GetOrganizations200ResponseOneOfInner[] =
      await auth0AsyncWrapper(() =>
        usersManagement.getUserOrganizations({ id: userId })
      )
    if (organizations.length > 1) {
      throw new createHttpError.Conflict(
        'User can be a member of only one tenant'
      )
    }
    const [organization] = organizations
    if (organization == null) {
      throw new createHttpError.Conflict(
        'User suppose to be a member of tenant organization'
      )
    }

    return organizationToTenant(organization)
  }

  async createAccount(
    _tenantId: string,
    createParams: InternalAccountCreate
  ): Promise<Account> {
    const { type, params: account } = createParams

    if (type !== 'AUTH0') {
      throw new Error('Invalid operation')
    }
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users

    const user = await auth0AsyncWrapper(() =>
      userManager.create({
        connection: CONNECTION_NAME,
        email: account.email,
        // NOTE: We need at least one upper case character
        password: generateRandomPassword(),
        app_metadata: {
          role: account.role,
          isReviewer: account.isReviewer,
          isReviewRequired: account.isReviewRequired,
          reviewerId: account.reviewerId,
          escalationLevel: account.escalationLevel,
          escalationReviewerId: account.escalationReviewerId,
        } as AppMetadata,
        verify_email: false,
      })
    )

    return userToAccount(user)
  }

  async patchAccount(
    _tenantId: string,
    accountId: string,
    patchData: PatchAccountData
  ): Promise<Account> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users

    const user = await auth0AsyncWrapper(() =>
      userManager.get({ id: accountId })
    )

    const patchedUser = await auth0AsyncWrapper(() =>
      userManager.update(
        { id: accountId },
        {
          app_metadata: {
            ...user.app_metadata,
            ...(patchData.app_metadata && {
              app_metadata: patchData.app_metadata,
            }),
            // Specific Undefined Check Don't Change
            ...(patchData.blockedReason !== undefined && {
              blockedReason: patchData.blockedReason,
            }),
          },
          user_metadata: {
            ...user.user_metadata,
            ...patchData.user_metadata,
          },
          blocked: patchData.blocked,
        }
      )
    )
    return userToAccount(patchedUser)
  }

  async getTenantAccounts(tenant: Tenant): Promise<Account[]> {
    if (!tenant) {
      throw new Error('Tenant is required to fetch accounts from Auth0')
    }

    let totalCount = 0
    let page = 0
    const accounts: Account[] = []
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)

    const organizationManager = managementClient.organizations
    const userManager = managementClient.users

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await auth0AsyncWrapper(() =>
        organizationManager.getMembers({
          id: tenant.orgId,
          include_totals: true,
          per_page: 50,
          page,
        })
      )
      const ids = result.members.map((x) => x.user_id)
      if (ids.length == 0) {
        break
      }
      const users = await auth0AsyncWrapper(() =>
        userManager.getAll({
          q: `user_id:(${ids.map((id) => `"${id}"`).join(' OR ')})`,
        })
      )
      accounts.push(...users.map(userToAccount))
      totalCount += result.members.length
      if (totalCount >= result.total) {
        break
      }
      page += 1
    }
    return accounts
  }

  async getAccountByIds(accountIds: string[]): Promise<Account[]> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users

    const users = await auth0AsyncWrapper(() =>
      userManager.getAll({
        q: `user_id:(${accountIds.map((id) => `"${id}"`).join(' OR ')})`,
      })
    )
    return users.map(userToAccount)
  }

  async createOrganization(
    _tenantId: string,
    createParams: InternalOrganizationCreate
  ): Promise<Tenant> {
    const { type, params } = createParams

    if (type !== 'AUTH0') {
      throw new Error('Invalid operation')
    }

    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations

    const organization = await auth0AsyncWrapper(() =>
      organizationManager.create(params)
    )

    return organizationToTenant(organization)
  }

  async patchOrganization(
    tenantId: string,
    patch: Partial<Auth0TenantMetadata>
  ): Promise<Tenant> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations

    const organization = await auth0AsyncWrapper(() =>
      organizationManager.update(
        { id: tenantId },
        {
          metadata: {
            ...patch,
            ...(patch.isProductionAccessDisabled != null && {
              isProductionAccessDisabled: patch.isProductionAccessDisabled
                ? 'true'
                : 'false',
            }),
          },
        }
      )
    )

    return organizationToTenant(organization)
  }

  async addAccountToOrganization(
    tenant: Tenant,
    account: Account
  ): Promise<void> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations
    await organizationManager.addMembers(
      { id: tenant.orgId },
      { members: [account.id] }
    )
  }

  async deleteAccountFromOrganization(
    tenant: Tenant,
    account: Account
  ): Promise<void> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations
    await organizationManager.deleteMembers(
      { id: tenant.orgId },
      { members: [account.id] }
    )
  }

  async deleteAccount(account: Account): Promise<void> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users
    await userManager.delete({ id: account.id })
  }

  async getTenants(auth0Domain?: string): Promise<Tenant[]> {
    const domain = auth0Domain ?? this.auth0Domain
    const managementClient = await getAuth0ManagementClient(domain)
    const user = getContext()?.user
    const organizationManager = managementClient.organizations
    let pageNumber = 0
    const limitPerPage = 100
    let organizations: GetOrganizations200ResponseOneOfInner[] = []
    let morePagesAvailable = true

    while (morePagesAvailable) {
      const pagedOrganizations = await auth0AsyncWrapper(() =>
        organizationManager.getAll({
          per_page: limitPerPage,
          page: pageNumber,
          include_totals: true,
        })
      )

      organizations = [...organizations, ...pagedOrganizations.organizations]
      pageNumber++
      morePagesAvailable = pagedOrganizations.total > organizations.length
    }

    const tenants = organizations.map(organizationToTenant)

    if (envIsNot('prod') || !user?.allowedRegions) {
      return tenants
    }

    return tenants
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const tenants = await this.getTenants()
    return tenants.find((tenant) => tenant.id === tenantId) ?? null
  }
}
