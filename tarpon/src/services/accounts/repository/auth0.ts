import {
  GetOrganizations200ResponseOneOfInner,
  UserEnrollmentStatusEnum,
} from 'auth0'
import { BadRequest, Conflict, NotFound } from 'http-errors'
import {
  Auth0TenantMetadata,
  BaseAccountsRepository,
  InternalAccountCreate,
  InternalOrganizationCreate,
  MicroTenantInfo,
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
      throw new BadRequest('User id is required')
    }

    const managementClient = await getAuth0ManagementClient(this.auth0Domain)

    const usersManagement = managementClient.users

    const user = await auth0AsyncWrapper(() =>
      usersManagement.get({ id: userId })
    )

    const organization = await auth0AsyncWrapper(() =>
      managementClient.organizations.getByName({
        name: user.app_metadata.orgName,
      })
    )

    if (organization == null) {
      throw new Conflict('User suppose to be a member of tenant organization')
    }

    return organizationToTenant(organization)
  }

  async unblockAccount(
    _tenantInfo: MicroTenantInfo,
    accountId: string
  ): Promise<Account> {
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

    const user = await auth0AsyncWrapper(() =>
      managementClient.users.get({ id: userId })
    )

    const organization = await auth0AsyncWrapper(() =>
      managementClient.organizations.getByName({
        name: user.app_metadata.orgName,
      })
    )

    if (organization == null) {
      throw new Conflict('User suppose to be a member of tenant organization')
    }

    return organizationToTenant(organization)
  }

  async createAccount(
    tenantInfo: MicroTenantInfo,
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
        name: account.name,
        // NOTE: We need at least one upper case character
        password: generateRandomPassword(),
        app_metadata: {
          role: account.role,
          isReviewer: account.isReviewer,
          isReviewRequired: account.isReviewRequired,
          reviewerId: account.reviewerId,
          escalationLevel: account.escalationLevel,
          escalationReviewerId: account.escalationReviewerId,
          orgName: tenantInfo.orgName,
          tenantId: tenantInfo.tenantId,
        } as AppMetadata,
        user_metadata: {
          ...(account.department && { department: account.department }),
          ...(account.staffId && { staffId: account.staffId }),
        },
        verify_email: false,
      })
    )

    return userToAccount(user)
  }

  async patchAccount(
    tenantInfo: MicroTenantInfo,
    accountId: string,
    patchData: PatchAccountData
  ): Promise<Account> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users

    const user = await auth0AsyncWrapper(() =>
      userManager.get({ id: accountId })
    )

    const patchedAppMetadata = {
      ...user.app_metadata,
      ...patchData.app_metadata,
    }

    // is to clean the nested app_metadata field which was created to incorrect destructing of patchData
    if ('app_metadata' in patchedAppMetadata) {
      delete patchedAppMetadata['app_metadata']
    }

    const patchedUser = await auth0AsyncWrapper(() =>
      userManager.update(
        { id: accountId },
        {
          ...(patchData.name && { name: patchData.name }),
          app_metadata: {
            ...patchedAppMetadata,
            // Specific Undefined Check Don't Change
            ...(patchData.blockedReason !== undefined && {
              blockedReason: patchData.blockedReason,
            }),
            ...(patchData.role && {
              role: patchData.role,
            }),
            ...(patchedAppMetadata.escalationLevel === undefined && {
              escalationLevel: null,
            }),
            ...(patchedAppMetadata.escalationReviewerId === undefined && {
              escalationReviewerId: null,
            }),
            ...(patchedAppMetadata.reviewerId === undefined && {
              reviewerId: null,
            }),
            tenantId: tenantInfo.tenantId,
            orgName: tenantInfo.orgName,
          },
          user_metadata: {
            ...user.user_metadata,
            ...patchData.user_metadata,
            ...(patchData.staffId && { staffId: patchData.staffId }),
            ...(patchData.department && { department: patchData.department }),
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
          q: `user_id: "${ids.join('" OR "')}"`,
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
        q: `user_id: "${accountIds.join('" OR "')}"`,
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
    const tenant = await this.getTenantByIdInternal(tenantId)

    if (!tenant) {
      throw new NotFound(`Organization not found with for tenant ${tenantId}`)
    }
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const organizationManager = managementClient.organizations

    const organization = await auth0AsyncWrapper(() =>
      organizationManager.update(
        { id: tenant.id },
        {
          metadata: {
            ...tenant.metadata,
            ...(patch.mfaEnabled != null && {
              mfaEnabled: patch.mfaEnabled,
            }),
            ...(patch.passwordResetDays != null && {
              passwordResetDays: patch.passwordResetDays.toString,
            }),
            ...(patch.isProductionAccessDisabled != null && {
              isProductionAccessDisabled: patch.isProductionAccessDisabled,
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

  async resetMfa(accountId: string): Promise<void> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const userManager = managementClient.users
    const gaurdianManager = managementClient.guardian
    const enrollments = await auth0AsyncWrapper(() =>
      userManager.getEnrollments({
        id: accountId,
      })
    )

    await Promise.all(
      enrollments.map((enrollment) => {
        if (
          enrollment.id &&
          enrollment.status === UserEnrollmentStatusEnum.confirmed
        ) {
          return gaurdianManager.deleteGuardianEnrollment({
            id: enrollment.id,
          })
        }
      })
    )
  }

  async getTenantsInternal(
    auth0Domain?: string
  ): Promise<GetOrganizations200ResponseOneOfInner[]> {
    const domain = auth0Domain ?? this.auth0Domain
    const managementClient = await getAuth0ManagementClient(domain)
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

    return organizations
  }

  async getTenants(auth0Domain?: string): Promise<Tenant[]> {
    const tenants = await this.getTenantsInternal(auth0Domain)
    return tenants.map(organizationToTenant)
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const tenants = await this.getTenants()
    return tenants.find((tenant) => tenant.id === tenantId) ?? null
  }

  private async getTenantByIdInternal(
    tenantId: string
  ): Promise<GetOrganizations200ResponseOneOfInner | null> {
    const tenants = await this.getTenantsInternal()
    // tenant id is in metadata
    return (
      tenants.find((tenant) => tenant.metadata.tenantId === tenantId) ?? null
    )
  }
}
