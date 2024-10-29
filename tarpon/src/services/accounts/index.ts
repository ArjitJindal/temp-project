import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  Unauthorized,
} from 'http-errors'
import {
  GetOrganizations200ResponseOneOfInner,
  GetUsers200ResponseOneOfInner,
  ManagementClient,
  UserUpdate,
} from 'auth0'
import { MongoClient } from 'mongodb'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { memoize, sortBy } from 'lodash'
import { CaseRepository } from '../cases/repository'
import { AlertsRepository } from '../alerts/repository'
import { Account as ApiAccount } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { AccountSettings } from '@/@types/openapi-internal/AccountSettings'
import {
  AppMetadata,
  auth0AsyncWrapper,
  getAuth0AuthenticationClient,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { TenantCreationRequest } from '@/@types/openapi-internal/TenantCreationRequest'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { RoleService } from '@/services/roles'
import { getContext, hasFeature, tenantSettings } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ACCOUNTS_COLLECTION } from '@/utils/mongodb-definitions'
import { isFlagrightInternalUser, isRoleAboveAdmin } from '@/@types/jwt'
import {
  DefaultApiAccountsChangeTenantRequest,
  DefaultApiAccountsEditRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'
import { AccountInvitePayload } from '@/@types/openapi-internal/AccountInvitePayload'
import { envIs, envIsNot } from '@/utils/env'
import { getNonDemoTenantId } from '@/utils/tenant'
import dayjs from '@/utils/dayjs'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

// todo: move to config?
const CONNECTION_NAME = 'Username-Password-Authentication'

export type Account = ApiAccount

export type Tenant = {
  id: string
  name: string
  orgId: string
  apiAudience: string
  region: string
  isProductionAccessDisabled: boolean
}

export type TenantBasic = {
  id: string
  name: string
  auth0Domain?: string
}

type Auth0TenantMetadata = {
  tenantId: string
  consoleApiUrl: string
  apiAudience: string
  auth0Domain: string
  region: FlagrightRegion
  isProductionAccessDisabled: string
  tenantCreatedAt: string
}

type ActiveSession = {
  PartitionKeyID: string
  SortKeyID: string
  userId: string
  userAgent: string
  deviceFingerprint: string
  createdAt: number
}

@traceable
export class AccountsService {
  private config: { auth0Domain: string }
  private mongoDb: MongoClient
  private dynamoDb: DynamoDBDocumentClient | undefined
  private roleService: RoleService

  constructor(
    config: { auth0Domain: string },
    connections: { mongoDb: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.config = config
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.roleService = new RoleService({
      auth0Domain: this.config.auth0Domain,
    })
  }

  public static async getInstance() {
    return new AccountsService(
      { auth0Domain: getContext()?.auth0Domain as string },
      { mongoDb: await getMongoDbClient() }
    )
  }

  public async getAllAccountsMongo(tenantId: string): Promise<Account[]> {
    const db = this.mongoDb.db()

    const accounts = await db
      .collection<Account>(ACCOUNTS_COLLECTION(tenantId))
      .find()
      .toArray()

    return accounts
  }

  public async getAllActiveAccounts(): Promise<Account[]> {
    const userId = (getContext()?.user as Account).id

    const tenant = await this.getAccountTenant(userId)
    const accounts = await this.getTenantAccounts(tenant)
    return accounts.filter((account) => !account.blocked)
  }

  private static organizationToTenant(
    organization: GetOrganizations200ResponseOneOfInner
  ): Tenant {
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
      isProductionAccessDisabled:
        organization.metadata?.isProductionAccessDisabled === 'true',
    }
  }

  public async updateAuth0TenantMetadata(
    tenantId: string,
    updatedMetadata: Partial<Auth0TenantMetadata>
  ): Promise<void> {
    const tenant = await this.getTenantById(tenantId)
    if (tenant == null) {
      logger.error(`Unable to find tenant by id: ${tenantId}`)
      return
    }
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const organizationManager = managementClient.organizations
    const organization = await auth0AsyncWrapper(() =>
      organizationManager.get({
        id: tenant.orgId,
      })
    )

    await organizationManager.update(
      { id: tenant.orgId },
      { metadata: { ...organization.metadata, ...updatedMetadata } }
    )
  }
  private static userToAccount(user: GetUsers200ResponseOneOfInner): Account {
    const {
      app_metadata,
      user_id,
      email,
      last_login,
      created_at,
      last_password_reset,
    } = user
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
      reviewerId: app_metadata?.reviewerId,
      ...(app_metadata?.blockedReason && {
        blockedReason: app_metadata.blockedReason,
      }),
      lastLogin: dayjs(last_login as string).valueOf(),
      createdAt: dayjs(created_at as string).valueOf(),
      lastPasswordReset: dayjs(last_password_reset as string).valueOf(),
      escalationLevel: app_metadata?.escalationLevel,
      escalationReviewerId: app_metadata?.escalationReviewerId,
      isReviewer: app_metadata?.isReviewer,
    }
  }

  private generateRandomPassword() {
    const randomString = 'TheBestProduct'

    return `P-${randomString}@${Date.now()}`
  }

  async resetPassword(accountId: string) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

    const user = await this.getAccount(accountId)

    if (!user.email) {
      throw new NotFound('User not found')
    }

    await managementClient.users.update(
      { id: accountId },
      { password: this.generateRandomPassword() }
    )

    await this.sendPasswordResetEmail(user.email)
  }

  async getAccountTenant(userId: string): Promise<Tenant> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

    const usersManagement = managementClient.users
    const organizations: GetOrganizations200ResponseOneOfInner[] =
      await auth0AsyncWrapper(() =>
        usersManagement.getUserOrganizations({ id: userId })
      )
    if (organizations.length > 1) {
      throw new Conflict('User can be a member of only one tenant')
    }
    const [organization] = organizations
    if (organization == null) {
      throw new Conflict('User suppose to be a member of tenant organization')
    }

    return AccountsService.organizationToTenant(organization)
  }

  public async accountsChangeTenantHandler(
    request: DefaultApiAccountsChangeTenantRequest,
    userId: string
  ) {
    const { newTenantId } = request.ChangeTenantPayload
    await this.changeUserTenant(request.accountId, newTenantId, userId)
    return
  }

  async getTenantById(rawTenantId: string): Promise<Tenant | null> {
    const tenantId = getNonDemoTenantId(rawTenantId)
    const allTenants = await this.getTenants()
    return allTenants.find((tenant) => tenant.id === tenantId) ?? null
  }

  public async inviteAccount(
    organization: Tenant,
    values: AccountInvitePayload
  ): Promise<ApiAccount> {
    const {
      role,
      email,
      reviewerId,
      escalationLevel,
      isReviewer,
      escalationReviewerId,
    } = values
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

    const user = await this.createAccountInOrganization(organization, {
      email,
      role: inviteRole,
      reviewerId,
      escalationLevel,
      isReviewer,
      escalationReviewerId,
    })

    return user
  }

  async createAccountInOrganization(
    tenant: Tenant,
    params: {
      email: string
      role: string
      isReviewer?: boolean
      isReviewRequired?: boolean
      reviewerId?: string
      escalationLevel?: string
      escalationReviewerId?: string
    }
  ): Promise<Account> {
    let user: GetUsers200ResponseOneOfInner | null = null
    let account: Account | null = null
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const organizationManager = managementClient.organizations
    try {
      const existingUser = await auth0AsyncWrapper(() =>
        userManager.getAll({
          q: `email:"${params.email}"`,
          per_page: 1,
          fields: 'user_id,blocked',
        })
      )

      if (existingUser.length > 0) {
        /* Temporary workaround for adding again blocked user to organization need to be removed after unblock user flow will be implemented */
        if (existingUser[0].blocked) {
          user = await auth0AsyncWrapper(() =>
            userManager.update(
              { id: existingUser[0].user_id as string },
              { blocked: false, app_metadata: { blockedReason: null } }
            )
          )

          await this.roleService.setRole(
            tenant.id,
            user.user_id as string,
            params.role
          )
        } else {
          throw new BadRequest('The user already exists.')
        }
      } else {
        user = await auth0AsyncWrapper(() =>
          userManager.create({
            connection: CONNECTION_NAME,
            email: params.email,
            // NOTE: We need at least one upper case character
            password: this.generateRandomPassword(),
            app_metadata: {
              role: params.role,
              isReviewer: params.isReviewer,
              isReviewRequired: params.isReviewRequired,
              reviewerId: params.reviewerId,
              escalationLevel: params.escalationLevel,
              escalationReviewerId: params.escalationReviewerId,
            } as AppMetadata,
            verify_email: false,
          })
        )
        logger.info('Created user', {
          email: params.email,
        })
        await this.roleService.setRole(
          tenant.id,
          user.user_id as string,
          params.role
        )
      }
      account = AccountsService.userToAccount(user)
      await organizationManager.addMembers(
        { id: tenant.orgId },
        { members: [account.id] }
      )
      logger.info(`Added user to orginization ${tenant.orgId}`, {
        email: params.email,
        account: account.id,
      })
      await this.sendPasswordResetEmail(params.email)
      await this.insertAuth0UserToMongo(tenant.id, [account])
    } catch (e) {
      if (user) {
        await userManager.delete({ id: user.user_id as string })
        logger.info('Deleted user', {
          email: params.email,
        })
      }
      throw e
    }
    return account
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
    logger.info(`Sent password reset email`, {
      email,
    })
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

  async getTenantAccountsRaw(
    tenant: Tenant
  ): Promise<GetUsers200ResponseOneOfInner[]> {
    const accounts: GetUsers200ResponseOneOfInner[] = []
    let totalCount = 0
    let page = 0

    const managementClient: ManagementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

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
      accounts.push(...users)
      totalCount += result.members.length
      if (totalCount >= result.total) {
        break
      }
      page += 1
    }
    return accounts
  }

  async getTenantAccounts(tenant: Tenant): Promise<Account[]> {
    const rawAccounts = await this.getTenantAccountsRaw(tenant)
    return rawAccounts.map(AccountsService.userToAccount)
  }

  async refreshActiveSessions(
    tenantId: string,
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<void> {
    if (!this.dynamoDb) {
      throw new Error('DynamoDB client is not initialized')
    }
    const dynamoDb = this.dynamoDb
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions
    if (!maxActiveSessions) {
      return
    }
    const activeSessions = await this.getActiveSessions(tenantId, userId)
    if (activeSessions.length >= maxActiveSessions) {
      const sortedActiveSessions = sortBy(activeSessions, 'createdAt')
      const sessionsToDelete = sortedActiveSessions.slice(
        0,
        activeSessions.length - maxActiveSessions + 1
      )
      await Promise.all(
        sessionsToDelete.map((sessionToDelete) =>
          dynamoDb.send(
            new DeleteCommand({
              TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
              Key: {
                PartitionKeyID: sessionToDelete.PartitionKeyID,
                SortKeyID: sessionToDelete.SortKeyID,
              },
            })
          )
        )
      )
    }
    const keys = DynamoDbKeys.ACTIVE_SESSIONS(tenantId, userId, deviceInfo)
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Item: {
          ...keys,
          userId,
          ...deviceInfo,
          createdAt: Date.now(),
        },
      })
    )
  }

  async validateActiveSession(
    tenantId: string,
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<void> {
    if (!this.dynamoDb) {
      throw new Error('DynamoDB client is not initialized')
    }
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions
    if (!maxActiveSessions) {
      return
    }
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.ACTIVE_SESSIONS(tenantId, userId, deviceInfo),
      })
    )
    if (!result.Item) {
      // Getting active sessions is needed when an admin user updates the max active sessions config
      const activeSessions = await this.getActiveSessions(tenantId, userId)
      if (activeSessions.length + 1 > maxActiveSessions) {
        throw new Unauthorized('Invalid session')
      }
    }
  }

  public async getActiveSessions(
    tenantId: string,
    userId: string
  ): Promise<ActiveSession[]> {
    if (!this.dynamoDb) {
      throw new Error('DynamoDB client is not initialized')
    }
    const result = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.ACTIVE_SESSIONS(tenantId, userId).PartitionKeyID,
        },
      })
    )
    return (result.Items ?? []) as ActiveSession[]
  }

  async getAccount(id: string): Promise<Account> {
    return this.getAccountInternal(id)
  }

  private getAccountInternal = memoize(async (id: string): Promise<Account> => {
    const managementClient: ManagementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const user = await auth0AsyncWrapper(() => userManager.get({ id }))
    return AccountsService.userToAccount(user)
  })

  async getAccounts(ids: string[]): Promise<Account[]> {
    const managementClient: ManagementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const q = `user_id: "${ids.join('" OR "')}"`
    const users = await auth0AsyncWrapper(() => userManager.getAll({ q }))
    return users.map(AccountsService.userToAccount)
  }

  async getTenants(auth0Domain?: string): Promise<Tenant[]> {
    const managementClient = await getAuth0ManagementClient(
      auth0Domain ?? this.config.auth0Domain
    )
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

    const tenants = organizations.map(AccountsService.organizationToTenant)

    if (envIsNot('prod') || !user?.allowedRegions) {
      return tenants
    }

    return tenants
  }

  async changeUserTenant(
    accountId: string,
    newTenantId: string,
    userId: string
  ) {
    const idToChange = accountId
    const oldTenant = await this.getAccountTenant(idToChange)
    const newTenant = await this.getTenantById(newTenantId)
    if (newTenant == null) {
      throw new BadRequest(`Unable to find tenant by id: ${newTenantId}`)
    }
    if (oldTenant.name === newTenant.name) {
      return
    }

    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const organizationManager = managementClient.organizations
    // Need to do this call to make sure operations are executed in exact order.
    // Without it if you try to remove and add member from the same organization,
    // it will be removed but will not be added
    const user = await this.getAccount(userId)

    await organizationManager.addMembers(
      { id: newTenant.orgId },
      { members: [userId] }
    )

    try {
      await organizationManager.deleteMembers(
        { id: oldTenant.orgId },
        { members: [userId] }
      )
    } catch (e) {
      // If the user was not deleted from the old tenant, we need to remove it from the new tenant
      await organizationManager.deleteMembers(
        { id: newTenant.orgId },
        { members: [userId] }
      )
      throw e
    }
    await this.deleteAuth0UserFromMongo(oldTenant.id, userId)

    if (user) {
      await this.insertAuth0UserToMongo(newTenant.id, [user])
    }
  }

  async deleteUser(tenant: Tenant, idToDelete: string, reassignedTo: string) {
    const userTenant = await this.getAccountTenant(idToDelete)
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users

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
          userManager.update(
            { id: user.id },
            { app_metadata: { reviewerId: reassignedTo } }
          )
        )
      )
    }

    const caseRepository = new CaseRepository(tenant.id, {
      mongoDb: this.mongoDb,
    })
    const alertRepository = new AlertsRepository(tenant.id, {
      mongoDb: this.mongoDb,
    })

    promises.push(
      ...[
        this.blockAccount(tenant.id, idToDelete, 'DELETED'),
        caseRepository.reassignCases(idToDelete, reassignedTo),
        alertRepository.reassignAlerts(idToDelete, reassignedTo),
      ]
    )

    await Promise.all(promises)
  }

  public async updateAuth0User(accountId: string, data: UserUpdate) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    await userManager.update({ id: accountId }, data)
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
      this.updateAuth0User(accountId, {
        blocked: true,
        app_metadata: { blockedReason },
      }),
      this.updateAuth0UserInMongo(tenantId, accountId, {
        blocked: true,
        blockedReason,
      }),
      userRoles.data.length &&
        !skipRemovingRoles &&
        userManager.deleteRoles(
          { id: accountId },
          { roles: userRoles.data.map((role) => role.id) }
        ),
    ])
  }

  public async deactivateAccount(
    tenant: Tenant,
    accountId: string,
    deactivateReason: Account['blockedReason']
  ) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )

    const userManager = managementClient.users
    await Promise.all([
      this.updateAuth0UserInMongo(tenant.id, accountId, {
        blocked: true,
      }),
      userManager.update(
        { id: accountId },
        { app_metadata: { blockedReason: deactivateReason }, blocked: true }
      ),
    ])
  }

  async deleteAuth0User(userId: string) {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    await userManager.delete({ id: userId })
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
    const userTenant = await this.getAccountTenant(accountId)
    const managementClient: ManagementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users

    if (userTenant == null || userTenant.id !== tenant.id) {
      throw new BadRequest(
        `Unable to find user "${accountId}" in the tenant |${tenant.id}|`
      )
    }

    if (patch.role) {
      await this.roleService.setRole(tenant.id, accountId, patch.role)
    }
    const user = await auth0AsyncWrapper(() =>
      userManager.get({
        id: accountId,
      })
    )

    const patchedUser = await auth0AsyncWrapper(() =>
      userManager.update(
        { id: accountId },
        {
          app_metadata: {
            ...user.app_metadata,
            reviewerId: patch.reviewerId ?? null,
            escalationReviewerId: patch.escalationReviewerId ?? null,
            escalationLevel: patch.escalationLevel ?? null,
            isReviewer: patch.isReviewer ?? null,
          },
        }
      )
    )

    await this.updateAuth0UserInMongo(tenant.id, accountId, patch)
    return AccountsService.userToAccount(patchedUser)
  }

  async getUserSettings(accountId: string): Promise<AccountSettings> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const user = await auth0AsyncWrapper(() =>
      userManager.get({ id: accountId })
    )
    return {
      demoMode: user.user_metadata?.['demoMode'] === true,
    }
  }

  /**
   * @deprecated The role service setRole method should be used instead.
   */
  async patchUserSettings(
    accountId: string,
    patch: Partial<AccountSettings>
  ): Promise<AccountSettings> {
    if (!accountId) {
      throw new BadRequest(`accountId is not provided`)
    }
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const user = await auth0AsyncWrapper(() =>
      userManager.get({
        id: accountId,
      })
    )

    const updatedUser = await auth0AsyncWrapper(() =>
      userManager.update(
        { id: accountId },
        { user_metadata: { ...user.user_metadata, ...patch } }
      )
    )
    return updatedUser.user_metadata ?? {}
  }

  async deactivateUser(
    tenantId: string,
    accountId: string,
    deactivate: boolean
  ): Promise<ApiAccount> {
    await Promise.all([
      this.updateAuth0User(accountId, {
        blocked: deactivate,
        app_metadata: { blockedReason: deactivate ? 'DEACTIVATED' : null },
      }),
      this.updateAuth0UserInMongo(tenantId, accountId, {
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
  ): Promise<GetOrganizations200ResponseOneOfInner> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const organizationManager = managementClient.organizations

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
      isProductionAccessDisabled: 'false',
      tenantCreatedAt: Date.now().toString(),
    }
    const organization = await auth0AsyncWrapper(() =>
      organizationManager.create({
        name: tenantData.tenantName.toLowerCase(),
        display_name: tenantData?.auth0DisplayName?.replace(
          /[^a-zA-Z0-9]/g,
          '_'
        ),
        metadata,
      })
    )

    if (organization.id == null) {
      throw new Error('Unable to create organization')
    }

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
        organizationManager.getByName({
          name: tenantName.toLowerCase(),
        })
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
    organization: GetOrganizations200ResponseOneOfInner,
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
          isProductionAccessDisabled:
            organization.metadata?.isProductionAccessDisabled === 'true',
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
      isProductionAccessDisabled:
        organization.metadata?.isProductionAccessDisabled === 'true',
    })

    await this.insertAuth0UserToMongo(
      tenantId as unknown as string,
      allAccounts
    )
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
    const db = this.mongoDb.db()

    const accounts = await db
      .collection<Account>(ACCOUNTS_COLLECTION(tenantId))
      .find({ role: { $in: roles } })
      .project({ id: 1, _id: 0 })
      .toArray()

    return accounts.map((account) => account.id)
  }

  async getAccountByEmail(email: string): Promise<Account | null> {
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const userManager = managementClient.users
    const users = await auth0AsyncWrapper(() =>
      userManager.getAll({
        q: `email:(${email})`,
        per_page: 1,
      })
    )

    return users.map(AccountsService.userToAccount)[0] ?? null
  }

  async blockAccountBruteForce(account: Account) {
    // DONT'T DO ANY MONGO UPDATES HERE.
    // THIS IS CALLED FROM AN AUTH0 WEBHOOK, AND WE ONLY TRIGGER IT FROM EU-1
    // SINCE ALL LOGINS ARE IN EU-1
    const managementClient = await getAuth0ManagementClient(
      this.config.auth0Domain
    )
    const accountId = account.id

    if (account.blocked) {
      logger.info(
        `Account ${accountId} is already blocked because of ${account.blockedReason}. Skipping blocking again.`
      )
    }

    const userBlocksManager = managementClient.userBlocks
    await Promise.all([
      ...(!account.blocked
        ? [
            this.updateAuth0User(accountId, {
              blocked: true,
              app_metadata: { blockedReason: 'BRUTE_FORCE' },
            }),
          ]
        : []),
      userBlocksManager.delete({ id: accountId }),
    ])
  }
}
