import { BadRequest, Forbidden, NotFound } from 'http-errors'
import { GetOrganizations200ResponseOneOfInner, ManagementClient } from 'auth0'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { memoize } from 'lodash'
import { CaseRepository } from '../cases/repository'
import { AlertsRepository } from '../alerts/repository'
import { SLAPolicyRepository } from '../tenants/repositories/sla-policy-repository'
import { Auth0TenantMetadata, InternalUserCreate, Tenant } from './repository'
import { DynamoAccountsRepository } from './repository/dynamo'
import { Auth0AccountsRepository } from './repository/auth0'
import {
  Account,
  Account as ApiAccount,
} from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import {
  auth0AsyncWrapper,
  CONNECTION_NAME,
  generateRandomPassword,
  getAuth0AuthenticationClient,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { RoleService } from '@/services/roles'
import { getContext, hasFeature, tenantSettings } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { isFlagrightInternalUser, isRoleAboveAdmin } from '@/@types/jwt'
import {
  DefaultApiAccountsChangeTenantRequest,
  DefaultApiAccountsEditRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { AccountInvitePayload } from '@/@types/openapi-internal/AccountInvitePayload'
import { envIs } from '@/utils/env'
import { sendInternalProxyWebhook } from '@/utils/internal-proxy'
import { getNonDemoTenantId } from '@/utils/tenant'

export type TenantBasic = {
  id: string
  name: string
  auth0Domain?: string
}

@traceable
export class AccountsService {
  private config: { auth0Domain: string }
  private roleService: RoleService
  private dynamoDb: DynamoDBDocumentClient
  public cache: DynamoAccountsRepository
  public auth0: Auth0AccountsRepository
  public useCache: boolean | undefined

  constructor(
    config: { auth0Domain: string; useCache?: boolean },
    connections: { dynamoDb: DynamoDBDocumentClient }
  ) {
    this.config = config
    this.dynamoDb = connections.dynamoDb
    this.roleService = new RoleService(config, connections)
    this.cache = new DynamoAccountsRepository(
      this.config.auth0Domain,
      this.dynamoDb
    )
    this.auth0 = new Auth0AccountsRepository(this.config.auth0Domain)
    this.useCache = config.useCache ?? false
  }

  public async deleteOrganization(tenant: Tenant) {
    await this.auth0.deleteOrganization(tenant)
    await this.cache.deleteOrganization(tenant)
  }

  private shouldUseCache() {
    if (this.useCache != null) {
      return this.useCache
    }

    if (
      getContext()?.user?.role === 'whitelabel-root' ||
      getContext()?.user?.role === 'root'
    ) {
      return false
    }

    return true
  }

  public static getInstance(
    dynamoDb: DynamoDBDocumentClient,
    useCache: boolean = false
  ) {
    const auth0Domain = (getContext()?.auth0Domain ??
      process.env.AUTH0_DOMAIN) as string // to get auth0 credentials for dashboard widget in demo mode.
    return new AccountsService({ auth0Domain, useCache }, { dynamoDb })
  }

  public async getAllAccountsCache(tenantId: string): Promise<Account[]> {
    const accounts = await this.cache.getTenantAccounts({ id: tenantId })
    return accounts
  }

  public async getAllActiveAccounts(): Promise<Account[]> {
    const userId = (getContext()?.user as Account).id
    const tenant = await this.getAccountTenant(userId)
    const accounts = await this.getTenantAccounts(tenant)
    return accounts.filter((account) => !account.blocked)
  }

  public async updateAuth0TenantMetadata(
    tenantId: string,
    updatedMetadata: Partial<Auth0TenantMetadata>
  ): Promise<void> {
    await this.auth0.patchOrganization(tenantId, updatedMetadata)
  }

  async resetPassword(accountId: string) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

    const user = await this.getAccount(accountId)

    if (!user || !user.email) {
      throw new NotFound('User not found')
    }

    await managementClient.users.update(
      { id: accountId },
      { password: generateRandomPassword() }
    )

    await this.sendPasswordResetEmail(user.email)
  }

  async getAccountTenant(userId: string): Promise<Tenant> {
    if (!this.shouldUseCache()) {
      return this.auth0.getAccountTenant(userId)
    }

    const tenant = await this.cache.getAccountTenant(userId)

    if (!tenant) {
      const data = await this.auth0.getAccountTenant(userId)

      if (data) {
        await this.cache.createOrganization(userId, {
          type: 'DATABASE',
          params: data,
        })
      }

      return data
    }

    return tenant
  }

  public async accountsChangeTenantHandler(
    request: DefaultApiAccountsChangeTenantRequest,
    userId: string
  ) {
    const { newTenantId } = request.ChangeTenantPayload
    this.useCache = false
    await this.changeUserTenant(request.accountId, newTenantId, userId)
    return
  }

  async getTenantById(rawTenantId: string): Promise<Tenant | null> {
    const nonDemoTenantId = getNonDemoTenantId(rawTenantId)
    if (!this.shouldUseCache()) {
      return this.auth0.getTenantById(nonDemoTenantId)
    }

    const tenant = await this.cache.getTenantById(nonDemoTenantId)
    if (!tenant?.id) {
      const data = await this.auth0.getTenantById(nonDemoTenantId)
      if (data) {
        await this.cache.createOrganization(nonDemoTenantId, {
          type: 'DATABASE',
          params: data,
        })
      }
      return data
    }

    return tenant
  }

  public async inviteAccount(
    organization: Tenant,
    values: AccountInvitePayload
  ): Promise<ApiAccount> {
    const { role = 'analyst' } = values
    const inviteRole = role ?? 'analyst'
    if (inviteRole === 'root') {
      throw new Forbidden(`It's not possible to create a root user`)
    }
    const allAccounts: Account[] = await this.getTenantAccounts(organization)

    const existingAccount = allAccounts.filter(
      (account) => !isRoleAboveAdmin(account.role) && account.blocked === false
    )
    const settings = await tenantSettings(organization.id)

    if (
      settings?.limits?.seats &&
      existingAccount.length >= settings?.limits?.seats
    ) {
      throw new Forbidden(
        `You have reached the maximum number of users (${existingAccount.length} / ${settings?.limits?.seats})`
      )
    }

    return this.createAccount(organization, { ...values, role })
  }

  async createAccount(
    tenant: Tenant,
    params: InternalUserCreate
  ): Promise<Account> {
    let account: Account | null = null
    try {
      account = await this.getAccountByEmail(params.email)

      if (!account) {
        account = await this.createAccountInternal(tenant, params)
        await this.roleService.setRole(tenant.id, account.id, params.role)
      } else {
        if (account.blocked) {
          await this.updateBlockedReason(tenant.id, account.id, false, null)
          await this.roleService.setRole(tenant.id, account.id, params.role)
        } else {
          throw new BadRequest('The user already exists.')
        }
      }

      await this.addAccountToOrganizationInternal(tenant, account)
      await this.sendPasswordResetEmail(params.email)
    } catch (e) {
      if (account) {
        await this.deleteAuth0User(account)
      }
      throw e
    }
    return account
  }

  private async createAccountInternal(
    tenant: Tenant,
    params: InternalUserCreate
  ): Promise<Account> {
    const account = await this.auth0.createAccount(tenant.id, {
      type: 'AUTH0',
      params,
    })
    await this.cache.createAccount(tenant.id, {
      type: 'DATABASE',
      params: account,
    })
    return account
  }

  private async addAccountToOrganizationInternal(
    tenant: Tenant,
    account: Account
  ) {
    await this.auth0.addAccountToOrganization(tenant, account)
    await this.cache.addAccountToOrganization(tenant, account)
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    const managementClient: ManagementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

    const authenticationClient = await getAuth0AuthenticationClient(
      this.config.auth0Domain
    )

    const consoleClient = (
      await auth0AsyncWrapper(() =>
        managementClient.clients.getAll({ app_type: 'spa' })
      )
    ).filter((client) => client.client_metadata?.isConsole)[0]
    if (!consoleClient) {
      throw new Error('Cannot find Auth0 Console client!')
    }

    await authenticationClient.database.changePassword({
      client_id: consoleClient.client_id,
      connection: CONNECTION_NAME,
      email,
    })
    logger.info(`Sent password reset email`, { email })
  }

  private async updateUserCache(
    tenantId: string,
    userId: string,
    data: Partial<Account>
  ) {
    const account = await this.getAccount(userId)

    if (!account) {
      return
    }

    await this.cache.createAccount(tenantId, {
      type: 'DATABASE',
      params: { ...account, ...data },
    })
  }

  async getTenantAccounts(tenant: Tenant): Promise<Account[]> {
    if (!this.shouldUseCache()) {
      return this.auth0.getTenantAccounts(tenant)
    }

    const accounts = await this.cache.getTenantAccounts(tenant)

    if (!accounts.length) {
      const data = await this.auth0.getTenantAccounts(tenant)
      await this.cache.putMultipleAccounts(tenant.id, data)
      return data
    }
    return accounts
  }

  async getAccount(id: string): Promise<Account | null> {
    return this.getAccountInternal(id)
  }

  private getAccountInternal = memoize(
    async (id: string): Promise<Account | null> => {
      if (!this.shouldUseCache()) {
        return this.auth0.getAccount(id)
      }

      const account = await this.cache.getAccount(id)

      if (!account) {
        const data = await this.auth0.getAccount(id)
        if (data) {
          await this.cache.createAccount(id, {
            type: 'DATABASE',
            params: data,
          })
        }

        return data
      }

      return account
    }
  )

  async getAccounts(tenantId: string, ids: string[]): Promise<Account[]> {
    if (!this.shouldUseCache()) {
      return this.auth0.getAccountByIds(ids)
    }

    const accounts = await this.cache.getAccountByIds(ids)

    if (accounts.length !== ids.length) {
      const data = await this.auth0.getAccountByIds(ids)
      await this.cache.putMultipleAccounts(tenantId, data)

      return data
    }
    return accounts
  }

  async getTenants(
    auth0Domain?: string,
    useCache: boolean = false
  ): Promise<Tenant[]> {
    const domain = auth0Domain ?? this.config.auth0Domain
    if (!this.shouldUseCache() || !useCache) {
      return this.auth0.getTenants(domain)
    }

    const tenants = await this.cache.getTenants(domain)
    if (!tenants.length) {
      const data = await this.auth0.getTenants(domain)
      await this.cache.putMultipleTenants(data)
      return data
    }
    return tenants
  }

  async changeUserTenant(
    accountId: string,
    newTenantId: string,
    userId: string
  ) {
    const idToChange = accountId
    const [oldTenant, newTenant] = await Promise.all([
      this.getAccountTenant(idToChange),
      this.getTenantById(newTenantId),
    ])
    if (newTenant == null) {
      throw new BadRequest(`Unable to find tenant by id: ${newTenantId}`)
    }
    if (oldTenant.name === newTenant.name) {
      return
    }

    // Need to do this call to make sure operations are executed in exact order.
    // Without it if you try to remove and add member from the same organization,
    // it will be removed but will not be added
    const user = await this.getAccount(userId)
    if (!user) {
      throw new BadRequest(`Unable to find user by id: ${userId}`)
    }
    await this.addAccountToOrganization(newTenant, user)
    try {
      await this.deleteAccountFromOrganization(oldTenant, user)
    } catch (e) {
      // If the user was not deleted from the old tenant, we need to remove it from the new tenant
      await this.deleteAccountFromOrganization(newTenant, user)
      throw e
    }
    if (oldTenant.region !== newTenant.region) {
      await sendInternalProxyWebhook(
        newTenant.region as FlagrightRegion,
        { type: 'ACCOUNTS_REFRESH' },
        false
      )
    }
  }

  async addAccountToOrganization(tenant: Tenant, account: Account) {
    await this.auth0.addAccountToOrganization(tenant, account)
    await this.cache.addAccountToOrganization(tenant, account)
  }

  async deleteAccountFromOrganization(tenant: Tenant, account: Account) {
    await this.auth0.deleteAccountFromOrganization(tenant, account)
    await this.cache.deleteAccountFromOrganization(tenant, account)
  }

  async deleteUser(tenant: Tenant, idToDelete: string, reassignedTo: string) {
    const mongodb = await getMongoDbClient()
    const userTenant = await this.getAccountTenant(idToDelete)

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${idToDelete}" in the tenant |${tenant.id}|`
      )
    }

    const promises: any[] = []

    if (hasFeature('ADVANCED_WORKFLOWS')) {
      const allUsers = await this.getTenantAccounts(tenant)
      const usersWithReviewer = allUsers.filter(
        (user) => user.reviewerId === idToDelete
      )

      promises.push(
        ...usersWithReviewer.map((user) =>
          this.auth0.patchAccount(tenant.id, user.id, {
            app_metadata: { reviewerId: reassignedTo },
          })
        )
      )
    }

    const connections = { mongoDb: mongodb, dynamoDb: this.dynamoDb }
    const caseRepository = new CaseRepository(tenant.id, connections)
    const alertRepository = new AlertsRepository(tenant.id, connections)
    const slaPolicyRepository = new SLAPolicyRepository(tenant.id, mongodb)

    promises.push(
      ...[
        this.blockAccount(tenant.id, idToDelete, 'DELETED'),
        caseRepository.reassignCases(idToDelete, reassignedTo),
        alertRepository.reassignAlerts(idToDelete, reassignedTo),
        slaPolicyRepository.reassignSLAPolicies(idToDelete, reassignedTo),
      ]
    )

    await Promise.all(promises)
  }

  public async updateBlockedReason(
    tenantId: string,
    accountId: string,
    blocked: boolean,
    blockedReason: Account['blockedReason'] | null
  ) {
    const data = { blocked, blockedReason }
    await this.auth0.patchAccount(tenantId, accountId, data)
    await this.cache.patchAccount(tenantId, accountId, data)
  }

  public async blockAccount(
    tenantId: string,
    accountId: string,
    blockedReason: Account['blockedReason'],
    skipRemovingRoles: boolean = false
  ): Promise<void> {
    const userTenant = await this.getAccountTenant(accountId)
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users

    if (userTenant == null || userTenant.id !== tenantId) {
      throw new BadRequest(
        `Unable to find user "${accountId}" in the tenant |${tenantId}|`
      )
    }

    const userRoles = await userManager.getRoles({ id: accountId })

    await Promise.all([
      this.updateBlockedReason(tenantId, accountId, true, blockedReason),
      userRoles.data.length &&
        !skipRemovingRoles &&
        userManager.deleteRoles(
          { id: accountId },
          { roles: userRoles.data.map((role) => role.id) }
        ),
    ])
  }

  async deleteAuth0User(user: Account) {
    await this.auth0.deleteAccount(user)
    await this.cache.deleteAccount(user)
  }

  async patchUserHandler(
    request: DefaultApiAccountsEditRequest,
    tenant: Tenant
  ): Promise<Account> {
    const { role } = request.AccountPatchPayload
    if (
      role === 'root' &&
      (!isFlagrightInternalUser() || getContext()?.user?.role !== 'root')
    ) {
      throw new Forbidden(`It's not possible to set a root role`)
    }
    return await this.patchUser(
      tenant,
      request.accountId,
      request.AccountPatchPayload
    )
  }

  async patchUser(
    tenant: Tenant,
    accountId: string,
    patch: AccountPatchPayload
  ): Promise<Account> {
    if (patch.role) {
      await this.roleService.setRole(tenant.id, accountId, patch.role)
    }
    const patchedUser = await this.auth0.patchAccount(tenant.id, accountId, {
      app_metadata: patch,
      role: patch.role,
    })
    await this.updateUserCache(tenant.id, accountId, patch)
    return patchedUser
  }

  async getUserSettings(accountId: string): Promise<AccountSettings> {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new BadRequest(`Unable to find user by id: ${accountId}`)
    }
    return {
      demoMode: account?.demoMode === true,
    }
  }

  /**
   * @deprecated The role service setRole method should be used instead.
   */
  async patchUserSettings(
    tenantId: string,
    accountId: string,
    patch: Partial<AccountSettings>
  ): Promise<AccountSettings> {
    await this.auth0.patchAccount(tenantId, accountId, {
      user_metadata: patch,
    })

    return {
      demoMode: patch.demoMode ?? false,
    }
  }

  async deactivateUser(
    tenantId: string,
    accountId: string,
    deactivate: boolean
  ): Promise<Account | null> {
    await Promise.all([
      this.updateBlockedReason(
        tenantId,
        accountId,
        deactivate,
        deactivate ? 'DEACTIVATED' : null
      ),
      this.updateUserCache(tenantId, accountId, {
        blocked: deactivate,
        blockedReason: deactivate ? 'DEACTIVATED' : undefined,
      }),
    ])

    const updatedUser = await this.getAccount(accountId)

    return updatedUser
  }

  async createAuth0Organization(
    tenantData: TenantCreationRequest,
    tenantId: string
  ): Promise<Tenant> {
    let consoleApiUrl = ''
    if (envIs('prod')) {
      consoleApiUrl = `https://${process.env.REGION}.api.flagright.com/console`
    } else if (envIs('sandbox')) {
      if (process.env.REGION === 'eu-1') {
        // Keeping the old sandbox URL for now
        consoleApiUrl = `https://sandbox.api.flagright.com/console`
      } else {
        // NOTE: We're using 'sandbox-{region}' instead of 'sandbox.{region}' as 3-level subdoamin is not allowed
        consoleApiUrl = `https://sandbox-${process.env.REGION}.api.flagright.com/console`
      }
    } else {
      consoleApiUrl = 'https://api.flagright.dev/console'
    }
    const metadata: Auth0TenantMetadata = {
      tenantId,
      consoleApiUrl,
      apiAudience: process.env.AUTH0_AUDIENCE as unknown as string,
      auth0Domain: tenantData.auth0Domain,
      region: process.env.REGION as FlagrightRegion,
      isProductionAccessDisabled: false,
      tenantCreatedAt: Date.now().toString(),
    }

    const organization = await this.auth0.createOrganization(tenantId, {
      type: 'AUTH0',
      params: {
        name: tenantData.tenantName.toLowerCase(),
        display_name: tenantData?.auth0DisplayName?.replace(
          /[^a-zA-Z0-9]/g,
          '_'
        ),
        metadata: {
          ...metadata,
          isProductionAccessDisabled: 'false',
        },
      },
    })

    return organization
  }

  async getOrganization(
    tenantName: string
  ): Promise<GetOrganizations200ResponseOneOfInner | null> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const organizationManager = managementClient.organizations

    try {
      const organization = await auth0AsyncWrapper(() =>
        organizationManager.getByName({ name: tenantName.toLowerCase() })
      )

      return organization
    } catch (e) {
      if ((e as Error & { statusCode: number })?.statusCode === 404) {
        return null
      }
      throw e
    }
  }

  async createAccountInOrganizationMultiple(
    tenant: Tenant,
    emails: string[],
    role: string
  ): Promise<void> {
    for await (const email of emails) {
      await this.createAccount(tenant, { email, role })
    }
  }

  async checkAuth0UserExistsMultiple(emails: string[]): Promise<boolean> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    try {
      const users = await auth0AsyncWrapper(() =>
        userManager.getAll({
          q: `email:(${emails.join(' OR ')})`,
          fields: 'email',
          include_fields: true,
          per_page: 1,
        })
      )

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

  async getAccountIdsForRoles(
    tenantId: string,
    roles: string[]
  ): Promise<string[]> {
    const accounts = await this.cache.getTenantAccounts({ id: tenantId })
    return accounts
      .filter((account) => roles.includes(account.role))
      .map((account) => account.id)
  }

  async getAccountByEmail(email: string): Promise<Account | null> {
    if (!this.shouldUseCache()) {
      return this.auth0.getAccountByEmail(email)
    }

    const account = await this.cache.getAccountByEmail(email)

    if (!account) {
      const data = await this.auth0.getAccountByEmail(email)

      if (data) {
        await this.cache.createAccountByEmail(email, data)
      }

      return data
    }

    return account
  }

  async unblockBruteForceAccount(account: Account) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const usersBlocksManager = managementClient.userBlocks
    await usersBlocksManager.delete({ id: account.id })
  }

  async blockAccountBruteForce(tenant: Tenant, account: Account) {
    // DONT'T DO ANY MONGO UPDATES HERE.
    // THIS IS CALLED FROM AN AUTH0 WEBHOOK, AND WE ONLY TRIGGER IT FROM EU-1
    // SINCE ALL LOGINS ARE IN EU-1
    const accountId = account.id

    if (account.blocked) {
      logger.info(
        `Account ${accountId} is already blocked because of ${account.blockedReason}. Skipping blocking again.`
      )
    }

    await Promise.all([
      ...(!account.blocked
        ? [this.updateBlockedReason(tenant.id, account.id, true, 'BRUTE_FORCE')]
        : []),
      this.unblockBruteForceAccount(account),
      sendInternalProxyWebhook(tenant.region as FlagrightRegion, {
        type: 'ACCOUNTS_REFRESH',
      }),
    ])
  }
}
