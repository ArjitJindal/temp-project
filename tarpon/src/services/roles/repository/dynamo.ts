import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { memoize } from 'lodash'
import { getRoleDisplayName } from '../utils'
import { BaseRolesRepository, CreateRoleInternal, DEFAULT_NAMESPACE } from '.'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import {
  auth0AsyncWrapper,
  getAuth0ManagementClient,
} from '@/utils/auth0-utils'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'

export class DynamoRolesRepository extends BaseRolesRepository {
  private dynamoClient: DynamoDBDocumentClient
  private auth0Domain: string

  constructor(auth0Domain: string, dynamoClient: DynamoDBDocumentClient) {
    super()
    this.dynamoClient = dynamoClient
    this.auth0Domain = auth0Domain
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
            namespace,
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
        Item: {
          ...DynamoDbKeys.ROLES_BY_NAME(this.auth0Domain, role.name),
          ...role,
        },
      })
    )

    return role
  }

  public async getRolesByName(name: string): Promise<AccountRole | null> {
    const managementClient = await getAuth0ManagementClient(this.auth0Domain)
    const rolesManager = managementClient.roles
    const roles = await auth0AsyncWrapper(() =>
      rolesManager.getAll({ name_filter: name })
    )

    const role = roles[0]

    if (!role) {
      return null
    }

    return this.getRole(role.id as string)
  }

  public getRole = memoize(async (id: string): Promise<AccountRole | null> => {
    const role = await this.dynamoClient.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES(this.auth0Domain, id),
      })
    )

    return role.Item as AccountRole
  })

  public async updateRolePermissions(
    roleId: string,
    permissions: Permission[]
  ) {
    const role = await this.getRole(roleId)

    if (!role) {
      throw new Error('Role not found')
    }

    await this.createRole(role.name, {
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
      throw new Error('Role not found')
    }

    await this.deleteRole(id)
    await this.createRole(tenantId, {
      type: 'DATABASE',
      params: { ...role, ...data },
    })
  }

  async getTenantRoles(tenantId: string): Promise<AccountRole[]> {
    const allRoles: AccountRole[] = []
    const defaultRoles = await this.getRolesByNamespace(DEFAULT_NAMESPACE)
    const roles = await this.getRolesByNamespace(tenantId)
    let updatedDefaultRoles = defaultRoles

    if (!this.shouldFetchRootRole()) {
      updatedDefaultRoles = defaultRoles.filter(
        (r) => r.name !== 'root' && r.name !== 'whitelabel-root'
      )
    }

    allRoles.push(...updatedDefaultRoles)
    allRoles.push(...roles)

    return allRoles.map((r) => ({
      ...r,
      name: getRoleDisplayName(r.name) || 'No name',
    }))
  }

  private async getRolesByNamespace(namespace: string): Promise<AccountRole[]> {
    const roles = await this.dynamoClient.send(
      new QueryCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.ROLES_BY_NAMESPACE(this.auth0Domain, namespace)
            .PartitionKeyID,
        },
        KeyConditionExpression: 'PartitionKeyID = :pk',
      })
    )

    return roles.Items as AccountRole[]
  }

  public async deleteRole(id: string) {
    const role = await this.getRole(id)

    if (!role) {
      throw new Error('Role not found')
    }

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
        Key: DynamoDbKeys.ROLES_BY_NAMESPACE(this.auth0Domain, role.name, id),
      })
    )

    await this.dynamoClient.send(
      new DeleteCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.ROLES_BY_NAME(this.auth0Domain, id),
      })
    )
  }
}
