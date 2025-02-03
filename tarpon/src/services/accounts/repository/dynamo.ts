import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DYNAMODB_TABLE_NAMES, StackConstants } from '@lib/constants'
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
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
import {
  batchGet,
  batchWrite,
  BatchWriteRequestInternal,
} from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getNonDemoTenantId } from '@/utils/tenant'
import { getContext } from '@/core/utils/context'
import { traceable } from '@/core/xray'

type CacheAccount = Account & { tenantId: string }

@traceable
export class DynamoAccountsRepository extends BaseAccountsRepository {
  private readonly dynamoClient: DynamoDBClient
  private readonly auth0Domain: string

  constructor(auth0Domain: string, dynamoClient: DynamoDBClient) {
    super()
    this.auth0Domain = auth0Domain
    this.dynamoClient = dynamoClient
  }

  async getAccount(accountId: string): Promise<CacheAccount | null> {
    const key = DynamoDbKeys.ACCOUNTS(this.auth0Domain, accountId)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: key,
      })
    )

    delete data.Item?.PartitionKeyID
    delete data.Item?.SortKeyID

    return data.Item as CacheAccount
  }

  async deleteOrganization(tenant: Tenant): Promise<void> {
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
        Key: DynamoDbKeys.ORGANIZATION(this.auth0Domain, tenant.id),
      })
    )
  }

  private getNonDemoTenantId(tenantId: string): string {
    return getNonDemoTenantId(tenantId)
  }

  async getTenantAccounts(tenant: Pick<Tenant, 'id'>): Promise<CacheAccount[]> {
    const key = DynamoDbKeys.ORGANIZATION_ACCOUNTS(
      this.auth0Domain,
      this.getNonDemoTenantId(tenant.id)
    )
    const data = await this.dynamoClient.send(
      new QueryCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
        },
      })
    )

    return (data.Items?.map((item) => {
      delete (item as any).PartitionKeyID
      delete (item as any).SortKeyID
      return item
    }) ?? []) as CacheAccount[]
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const key = DynamoDbKeys.ORGANIZATION(this.auth0Domain, tenantId)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        Key: key,
      })
    )

    delete data.Item?.PartitionKeyID
    delete data.Item?.SortKeyID

    return data.Item as Tenant
  }

  async getAccountByEmail(email: string): Promise<CacheAccount | null> {
    const key = DynamoDbKeys.ACCOUNTS_BY_EMAIL(this.auth0Domain, email)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: key,
      })
    )

    delete data.Item?.PartitionKeyID
    delete data.Item?.SortKeyID

    return data.Item as CacheAccount
  }

  async getAccountTenant(accountId: string): Promise<Tenant | null> {
    const account = await this.getAccount(accountId)
    if (!account) {
      return null
    }
    return this.getOrganization(this.getNonDemoTenantId(account.tenantId))
  }

  async getOrganization(tenantId: string): Promise<Tenant | null> {
    const key = DynamoDbKeys.ORGANIZATION(this.auth0Domain, tenantId)
    const data = await this.dynamoClient.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(
          this.getNonDemoTenantId(tenantId)
        ),
        Key: key,
      })
    )

    delete data.Item?.PartitionKeyID
    delete data.Item?.SortKeyID

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
            ...DynamoDbKeys.ACCOUNTS(this.auth0Domain, account.id),
            tenantId: nonDemoTenantId,
          },
        })
      ),
      this.dynamoClient.send(
        new PutCommand({
          TableName: DYNAMODB_TABLE_NAMES.TARPON,
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS_BY_EMAIL(this.auth0Domain, account.email),
          },
        })
      ),
      this.addAccountToOrganization({ id: nonDemoTenantId }, account),
    ])

    return { ...account, tenantId }
  }

  async createAccountByEmail(
    email: string,
    account: Account
  ): Promise<Account> {
    await this.dynamoClient.send(
      new PutCommand({
        TableName: DYNAMODB_TABLE_NAMES.TARPON,
        Item: {
          ...account,
          ...DynamoDbKeys.ACCOUNTS_BY_EMAIL(this.auth0Domain, email),
        },
      })
    )
    return account
  }

  async unblockAccount(tenantId: string, accountId: string): Promise<Account> {
    const account = (await this.getAccount(accountId)) as Account
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
    const account = (await this.getAccount(accountId)) as Account

    const updatedAccount: Account = {
      ...account,
      ...(patchData.role && { role: patchData.role }),
      ...(patchData.app_metadata && { app_metadata: patchData.app_metadata }),
      ...(patchData.user_metadata && {
        user_metadata: patchData.user_metadata,
      }),
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
      accountIds.map((id) => DynamoDbKeys.ACCOUNTS(this.auth0Domain, id))
    )

    return accounts.map((account) => {
      delete (account as any).PartitionKeyID
      delete (account as any).SortKeyID
      return account
    })
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
          ...DynamoDbKeys.ORGANIZATION(
            this.auth0Domain,
            this.getNonDemoTenantId(tenantId)
          ),
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
      isProductionAccessDisabled: patch.isProductionAccessDisabled ?? false,
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
    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...account,
          ...DynamoDbKeys.ORGANIZATION_ACCOUNTS(
            this.auth0Domain,
            this.getNonDemoTenantId(tenant.id),
            account.id
          ),
        },
      })
    )
  }

  async deleteAccountFromOrganization(
    tenant: Pick<Tenant, 'id'>,
    account: Account
  ): Promise<void> {
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ORGANIZATION_ACCOUNTS(
          this.auth0Domain,
          tenant.id,
          account.id
        ),
      })
    )
  }

  async deleteAccount(account: Account): Promise<void> {
    const accountToDelete = await this.getAccount(account.id)
    const tenantId = accountToDelete?.tenantId ?? getContext()?.tenantId

    await Promise.all([
      this.dynamoClient.send(
        new DeleteCommand({
          TableName: DYNAMODB_TABLE_NAMES.TARPON,
          Key: DynamoDbKeys.ACCOUNTS_BY_EMAIL(this.auth0Domain, account.email),
        })
      ),
      this.dynamoClient.send(
        new DeleteCommand({
          TableName:
            StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
          Key: DynamoDbKeys.ACCOUNTS(this.auth0Domain, account.id),
        })
      ),
      ...(tenantId
        ? [
            this.dynamoClient.send(
              new DeleteCommand({
                TableName: DYNAMODB_TABLE_NAMES.TARPON,
                Key: DynamoDbKeys.ORGANIZATION_ACCOUNTS(
                  this.auth0Domain,
                  this.getNonDemoTenantId(tenantId),
                  account.id
                ),
              })
            ),
          ]
        : []),
    ])
  }

  async deleteAllOrganizationAccounts(tenantId: string): Promise<void> {
    const key = DynamoDbKeys.ORGANIZATION_ACCOUNTS(
      this.auth0Domain,
      this.getNonDemoTenantId(tenantId)
    )

    const accounts = await this.dynamoClient.send(
      new QueryCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
        },
      })
    )

    for (const account of accounts.Items ?? []) {
      if (account.id) {
        await this.deleteAccount(account as Account)
      }
    }
  }

  async putMultipleAccounts(
    tenantId: string,
    accounts: Account[]
  ): Promise<void> {
    const allBatchWrites: BatchWriteRequestInternal[] = []

    accounts.forEach((account) => {
      allBatchWrites.push({
        PutRequest: {
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS(this.auth0Domain, account.id),
            tenantId: this.getNonDemoTenantId(tenantId),
          },
        },
      })
      allBatchWrites.push({
        PutRequest: {
          Item: {
            ...account,
            ...DynamoDbKeys.ORGANIZATION_ACCOUNTS(
              this.auth0Domain,
              this.getNonDemoTenantId(tenantId),
              account.id
            ),
            tenantId: this.getNonDemoTenantId(tenantId),
          },
        },
      })
      allBatchWrites.push({
        PutRequest: {
          Item: {
            ...account,
            ...DynamoDbKeys.ACCOUNTS_BY_EMAIL(this.auth0Domain, account.email),
          },
        },
      })
    })

    await batchWrite(
      this.dynamoClient,
      allBatchWrites,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID)
    )
  }

  async getTenants(auth0Domain?: string): Promise<Tenant[]> {
    const updatedAuth0Domain = auth0Domain ?? this.auth0Domain
    const query = new QueryCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.ORGANIZATION(
          updatedAuth0Domain,
          FLAGRIGHT_TENANT_ID
        ).PartitionKeyID,
      },
    })

    const result = await this.dynamoClient.send(query)

    return ((result.Items ?? []) as Tenant[]).filter(
      (item) => item.auth0Domain === updatedAuth0Domain
    )
  }

  async putMultipleTenants(tenants: Tenant[]): Promise<void> {
    await batchWrite(
      this.dynamoClient,
      tenants.map((tenant) => ({
        PutRequest: {
          Item: {
            ...tenant,
            ...DynamoDbKeys.ORGANIZATION(this.auth0Domain, tenant.id),
          },
        },
      })),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID)
    )
  }
}
