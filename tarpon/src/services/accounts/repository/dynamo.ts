import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DYNAMODB_TABLE_NAMES, StackConstants } from '@lib/constants'
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import { uniq } from 'lodash'
import {
  Auth0TenantMetadata,
  BaseAccountsRepository,
  InternalAccountCreate,
  InternalOrganizationCreate,
  PatchAccountData,
  Tenant,
} from '.'
import { Account } from '@/@types/openapi-internal/Account'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { batchGet, batchWrite } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getNonDemoTenantId } from '@/utils/tenant'

type CacheAccount = Account & { tenantId: string }

export class DynamoAccountsRepository extends BaseAccountsRepository {
  private readonly dynamoClient: DynamoDBClient

  constructor(dynamoClient: DynamoDBClient) {
    super()
    this.dynamoClient = dynamoClient
  }

  async getAccount(accountId: string): Promise<CacheAccount> {
    const key = DynamoDbKeys.ACCOUNTS(accountId)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: key,
      })
    )

    return data.Item as CacheAccount
  }

  private getNonDemoTenantId(tenantId: string): string {
    return getNonDemoTenantId(tenantId)
  }

  private async getOrganizationAccountIds(tenantId: string): Promise<string[]> {
    const organizationAccountsKey = DynamoDbKeys.ORGANIZATION_ACCOUNTS(
      this.getNonDemoTenantId(tenantId)
    )
    const organizationAccounts = await this.dynamoClient.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(
          this.getNonDemoTenantId(tenantId)
        ),
        Key: organizationAccountsKey,
      })
    )

    return organizationAccounts.Item?.accounts ?? []
  }

  async getTenantAccounts(tenant: Tenant): Promise<CacheAccount[]> {
    const accountIds = await this.getOrganizationAccountIds(tenant.id)

    return await batchGet<CacheAccount>(
      this.dynamoClient,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(
        this.getNonDemoTenantId(tenant.id)
      ),
      accountIds.map((id) => DynamoDbKeys.ACCOUNTS(id))
    )
  }

  async getAccountByEmail(email: string): Promise<CacheAccount | null> {
    const key = DynamoDbKeys.ACCOUNTS_BY_EMAIL(email)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: key,
      })
    )

    return data.Item as CacheAccount
  }

  async getAccountTenant(accountId: string): Promise<Tenant | null> {
    const account = await this.getAccount(accountId)
    return this.getOrganization(this.getNonDemoTenantId(account?.tenantId))
  }

  async getOrganization(tenantId: string): Promise<Tenant | null> {
    const key = DynamoDbKeys.ORGANIZATION(tenantId)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(
          this.getNonDemoTenantId(tenantId)
        ),
        Key: key,
      })
    )

    return data.Item as Tenant
  }

  async createAccount(
    tenantId: string,
    createParams: InternalAccountCreate
  ): Promise<CacheAccount> {
    if (createParams.type === 'AUTH0') {
      throw new Error('Cannot create account in cache with auth0 payload')
    }

    const nonDemoTenantId = this.getNonDemoTenantId(tenantId)

    const account = createParams.params

    await Promise.all([
      this.dynamoClient.send(
        new PutCommand({
          TableName:
            StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS(account.id),
            tenantId: nonDemoTenantId,
          },
        })
      ),
      this.dynamoClient.send(
        new PutCommand({
          TableName: DYNAMODB_TABLE_NAMES.TARPON,
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS_BY_EMAIL(account.email),
            tenantId: nonDemoTenantId,
          },
        })
      ),
      this.addAccountToOrganization({ id: nonDemoTenantId }, account),
    ])

    return { ...account, tenantId }
  }

  async unblockAccount(tenantId: string, accountId: string): Promise<Account> {
    const account = await this.getAccount(accountId)
    account.blocked = false
    await this.createAccount(tenantId, { type: 'DATABASE', params: account })
    return account
  }

  async patchAccount(
    tenantId: string,
    accountId: string,
    patchData: PatchAccountData
  ): Promise<Account> {
    const nonDemoTenantId = this.getNonDemoTenantId(tenantId)
    const account = await this.getAccount(accountId)

    const updatedAccount: Account = {
      ...account,
      ...patchData.app_metadata,
      ...patchData.user_metadata,
      ...(patchData.blocked != null && { blocked: patchData.blocked }),
      ...(patchData.blockedReason && {
        blockedReason: patchData.blockedReason,
      }),
    }

    await this.createAccount(nonDemoTenantId, {
      type: 'DATABASE',
      params: updatedAccount,
    })
    return updatedAccount
  }

  async getAccountByIds(accountIds: string[]): Promise<Account[]> {
    const accounts = await batchGet<Account>(
      this.dynamoClient,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
      accountIds.map((id) => DynamoDbKeys.ACCOUNTS(id))
    )

    return accounts
  }

  async createOrganization(
    tenantId: string,
    createParams: InternalOrganizationCreate
  ): Promise<Tenant> {
    if (createParams.type !== 'DATABASE') {
      throw new Error('Invalid operation')
    }

    const { params } = createParams

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...params,
          ...DynamoDbKeys.ORGANIZATION(this.getNonDemoTenantId(tenantId)),
        },
      })
    )

    return params
  }

  async patchOrganization(
    tenantId: string,
    patch: Partial<Auth0TenantMetadata>
  ): Promise<Tenant> {
    const tenant = await this.getOrganization(tenantId)
    if (!tenant) {
      throw new NotFound('Organization not found')
    }
    const updatedTenant: Tenant = {
      ...tenant,
      ...patch,
      isProductionAccessDisabled:
        patch.isProductionAccessDisabled === 'true' ??
        tenant.isProductionAccessDisabled, // TODO: fix this
    }
    await this.createOrganization(this.getNonDemoTenantId(tenantId), {
      type: 'DATABASE',
      params: updatedTenant,
    })
    return updatedTenant
  }

  async addAccountToOrganization(
    tenant: Pick<Tenant, 'id'>,
    account: Account
  ): Promise<void> {
    const currentAccounts = await this.getOrganizationAccountIds(
      this.getNonDemoTenantId(tenant.id)
    )
    const allAccounts = uniq([...currentAccounts, account.id])

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.ORGANIZATION_ACCOUNTS(
            this.getNonDemoTenantId(tenant.id)
          ),
          accounts: allAccounts,
        },
      })
    )
  }

  async addAccountsToOrganization(
    tenant: Pick<Tenant, 'id'>,
    accountIds: string[]
  ): Promise<void> {
    const currentAccounts = await this.getOrganizationAccountIds(
      this.getNonDemoTenantId(tenant.id)
    )
    const allAccounts = uniq([...currentAccounts, ...accountIds])

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.ORGANIZATION_ACCOUNTS(
            this.getNonDemoTenantId(tenant.id)
          ),
          accounts: allAccounts,
        },
      })
    )
  }

  async deleteAccountFromOrganization(
    tenant: Tenant,
    account: Account
  ): Promise<void> {
    const currentAccounts = await this.getOrganizationAccountIds(
      this.getNonDemoTenantId(tenant.id)
    )
    const allAccounts = currentAccounts.filter((id) => id !== account.id)
    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.ORGANIZATION_ACCOUNTS(
            this.getNonDemoTenantId(tenant.id)
          ),
          accounts: allAccounts,
        },
      })
    )
  }

  async deleteAccount(account: Account): Promise<void> {
    await Promise.all([
      this.dynamoClient.send(
        new DeleteCommand({
          TableName: DYNAMODB_TABLE_NAMES.TARPON,
          Key: DynamoDbKeys.ACCOUNTS_BY_EMAIL(account.email),
        })
      ),
      this.dynamoClient.send(
        new DeleteCommand({
          TableName:
            StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
          Key: DynamoDbKeys.ACCOUNTS(account.id),
        })
      ),
    ])
  }

  async putMultipleAccounts(
    tenantId: string,
    accounts: Account[]
  ): Promise<void> {
    await batchWrite(
      this.dynamoClient,
      accounts.map((account) => ({
        PutRequest: {
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS(account.id),
            tenantId: this.getNonDemoTenantId(tenantId),
          },
        },
      })),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID)
    )

    await batchWrite(
      this.dynamoClient,
      accounts.map((account) => ({
        PutRequest: {
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS_BY_EMAIL(account.email),
            tenantId: this.getNonDemoTenantId(tenantId),
          },
        },
      })),
      DYNAMODB_TABLE_NAMES.TARPON
    )

    await this.addAccountsToOrganization(
      { id: this.getNonDemoTenantId(tenantId) },
      accounts.map((account) => account.id)
    )
  }
}
