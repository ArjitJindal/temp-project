import { TarponStackConstants } from '@cdk/constants'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { DynamoDbKeys, TenantSettingName } from '@/core/dynamodb/dynamodb-keys'
import { getUpdateAttributesUpdateItemInput } from '@/utils/dynamodb'

export class TenantRepository {
  tenantId: string
  dynamoDb: AWS.DynamoDB.DocumentClient

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  public async getTenantSettings(
    settingNames?: TenantSettingName[]
  ): Promise<Partial<TenantSettings>> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ProjectionExpression: settingNames?.join(','),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return result.Item ? (result.Item as Partial<TenantSettings>) : {}
  }

  public async createOrUpdateTenantSettings(
    newTenantSettings: Partial<TenantSettings>
  ): Promise<Partial<TenantSettings>> {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
      ...getUpdateAttributesUpdateItemInput(newTenantSettings),
    }
    await this.dynamoDb.update(updateItemInput).promise()
    return newTenantSettings
  }
}
