import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { memoize } from 'lodash'
import {
  getNamespace,
  getNamespacedRoleName,
  getRoleDisplayName,
} from '../utils'
import { BaseRolesRepository, CreateRoleInternal, DEFAULT_NAMESPACE } from '.'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getNonDemoTenantId } from '@/utils/tenant'
import { traceable } from '@/core/xray'
import { Tenant } from '@/services/accounts/repository'
import { DynamoAccountsRepository } from '@/services/accounts/repository/dynamo'
import { Account } from '@/@types/openapi-internal/Account'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'

@traceable
export class DynamoRolesRepository extends BaseRolesRepository {
  private dynamoClient: DynamoDBDocumentClient
  private auth0Domain: string

  constructor(auth0Domain: string, dynamoClient: DynamoDBDocumentClient) {
    super()
    this.dynamoClient = dynamoClient
    this.auth0Domain = auth0Domain
  }

  private getTenantId(tenantId: string) {
    return getNonDemoTenantId(tenantId)
  }

  async createRole(namespace: string, data: CreateRoleInternal) {
    if (data.type !== 'DATABASE') {
      throw new Error('Invalid role type')
    }

    const role = data.params

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.ROLES(this.auth0Domain, role.id),
          ...role,
        },
      })
    )

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.ROLES_BY_NAMESPACE(
            this.auth0Domain,
            this.getTenantId(namespace),
            role.id
          ),
          ...role,
        },
      })
    )

    await this.dynamoClient.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: DynamoDbKeys.ROLES_BY_NAME(this.auth0Domain, role.name),
      })
    )

    return role
  }

  public getRole = memoize(async (id: string): Promise<AccountRole | null> => {
    const role = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES(this.auth0Domain, id),
      })
    )

    delete role.Item?.PartitionKeyID
    delete role.Item?.SortKeyID

    return role.Item as AccountRole
  })

  public async updateRolePermissions(
    roleId: string,
    permissions: Permission[]
  ) {
    const role = await this.getRole(roleId)

    if (!role) {
      throw new Error('Role not found with id: ' + roleId)
    }

    await this.createRole(getNamespace(role.name), {
      params: { ...role, permissions },
      type: 'DATABASE',
    })
  }

  public async updateRole(
    tenantId: string,
    id: string,
    data: Partial<AccountRole>
  ) {
    const role = await this.getRole(id)

    if (!role) {
      throw new Error('Role not found with id: ' + id)
    }

    const roleName = getNamespacedRoleName(tenantId, data.name || role.name)

    await this.createRole(tenantId, {
      type: 'DATABASE',
      params: {
        ...role,
        ...data,
        name: getNamespacedRoleName(tenantId, data.name || roleName),
      },
    })
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    const allRoles: AccountRole[] = []
    const defaultRoles = await this.getRolesByNamespace(DEFAULT_NAMESPACE)
    const roles = await this.getRolesByNamespace(tenantId)

    allRoles.push(...defaultRoles)
    allRoles.push(...roles)

    if (this.shouldFetchRootRole()) {
      return allRoles
    }

    return allRoles
  }

  private async getRolesByNamespace(namespace: string): Promise<AccountRole[]> {
    const roles = await this.dynamoClient.send(
      new QueryCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.ROLES_BY_NAMESPACE(
            this.auth0Domain,
            this.getTenantId(namespace)
          ).PartitionKeyID,
        },
        KeyConditionExpression: 'PartitionKeyID = :pk',
      })
    )

    return roles.Items as AccountRole[]
  }

  public async getRoleStatements(
    namespace: string,
    name: string
  ): Promise<PermissionStatements[]> {
    const role = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES_BY_NAME(
          this.auth0Domain,
          getNamespacedRoleName(namespace, name)
        ),
        ProjectionExpression: 'statements',
      })
    )

    return role.Item?.statements as PermissionStatements[]
  }

  public async deleteRole(id: string) {
    const role = await this.getRole(id)

    await this.dynamoClient.send(
      new DeleteCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES(this.auth0Domain, id),
      })
    )

    await this.dynamoClient.send(
      new DeleteCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES_BY_NAMESPACE(
          this.auth0Domain,
          this.getTenantId(getNamespace(role?.name || '')),
          id
        ),
      })
    )

    await this.dynamoClient.send(
      new DeleteCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES_BY_NAME(this.auth0Domain, role?.name || ''),
      })
    )
  }

  public async getUsersByRole(id: string, tenant: Tenant): Promise<Account[]> {
    const accountsService = new DynamoAccountsRepository(
      this.auth0Domain,
      this.dynamoClient
    )
    const accounts = await accountsService.getTenantAccounts(tenant)
    const role = await this.getRole(id)
    if (!role) {
      return []
    }
    const roleName = getRoleDisplayName(role.name)
    return accounts.filter((account) => account.role === roleName)
  }
}
