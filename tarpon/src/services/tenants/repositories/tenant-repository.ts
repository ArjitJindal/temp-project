import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { DynamoDbKeys, TenantSettingName } from '@/core/dynamodb/dynamodb-keys'
import { getUpdateAttributesUpdateItemInput } from '@/utils/dynamodb'
import { METADATA_COLLECTION } from '@/utils/mongoDBUtils'

type MetadataType = 'SLACK_WEBHOOK'
type MetadataPayload = { slackWebhookURL: string; originalResponse: any }

export class TenantRepository {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient

    this.tenantId = tenantId
  }

  public async getTenantSettings(
    settingNames?: TenantSettingName[]
  ): Promise<Partial<TenantSettings>> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ProjectionExpression: settingNames?.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    const settings = result.Item ? (result.Item as Partial<TenantSettings>) : {}

    // Push demo mode as a feature so its always easy to switch back.
    if (this.tenantId.endsWith('-test')) {
      if (!settings.features) {
        settings.features = ['DEMO_MODE']
      }
      if (settings.features?.indexOf('DEMO_MODE') === -1) {
        settings.features.push('DEMO_MODE')
      }
    }
    return settings
  }

  public async createOrUpdateTenantSettings(
    newTenantSettings: Partial<TenantSettings>
  ): Promise<Partial<TenantSettings>> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ReturnValues: 'UPDATED_NEW',

      ...getUpdateAttributesUpdateItemInput(newTenantSettings),
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
    return newTenantSettings
  }

  public async deleteTenantSettings(
    settingNames: TenantSettingName[]
  ): Promise<void> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ReturnValues: 'UPDATED_NEW',
      UpdateExpression: `REMOVE ${settingNames.join(',')}`,
    }

    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
  }

  public async getTenantMetadata(
    type: MetadataType
  ): Promise<MetadataPayload | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<MetadataPayload>(
      METADATA_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ type })
  }

  public async createOrUpdateTenantMetadata(
    type: MetadataType,
    payload: MetadataPayload
  ): Promise<void> {
    const db = this.mongoDb.db()
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
