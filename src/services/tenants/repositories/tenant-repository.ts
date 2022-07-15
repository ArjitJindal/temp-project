import { TarponStackConstants } from '@cdk/constants'
import { MongoClient } from 'mongodb'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { DynamoDbKeys, TenantSettingName } from '@/core/dynamodb/dynamodb-keys'
import { getUpdateAttributesUpdateItemInput } from '@/utils/dynamodb'
import { METADATA_COLLECTION } from '@/utils/mongoDBUtils'

type MetadataType = 'SLACK_WEBHOOK'
type MetadataPayload = { slackWebhookURL: string; originalResponse: any }

export class TenantRepository {
  tenantId: string
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
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

  public async getTenantMetadata(
    type: MetadataType
  ): Promise<MetadataPayload | null> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<MetadataPayload>(
      METADATA_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ type })
  }

  public async createOrUpdateTenantMetadata(
    type: MetadataType,
    payload: MetadataPayload
  ): Promise<void> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection(METADATA_COLLECTION(this.tenantId))
    await collection.replaceOne(
      {
        type,
      },
      {
        type,
        ...payload,
      },
      { upsert: true }
    )
    await collection.createIndex({
      type: 1,
    })
  }
}
