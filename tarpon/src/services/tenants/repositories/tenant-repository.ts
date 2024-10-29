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
import {
  METADATA_COLLECTION,
  TENANT_DELETION_COLLECTION,
} from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'
import { getTestEnabledFeatures } from '@/core/utils/context'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import dayjs from '@/utils/dayjs'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { getMongoDbClient } from '@/utils/mongodb-utils'

type MetadataType = 'SLACK_WEBHOOK'
type MetadataPayload = { slackWebhookURL: string; originalResponse: any }

const tenantSettingsCache = createNonConsoleApiInMemoryCache<TenantSettings>({
  max: 100,
  ttlMinutes: 10,
})

@traceable
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

  public static async isTenantDeleted(tenantId: string): Promise<boolean> {
    const mongoDb = await getMongoDbClient()
    const collection = mongoDb
      .db()
      .collection<DeleteTenant>(TENANT_DELETION_COLLECTION)
    const tenant = await collection.findOne({
      tenantId,
      latestStatus: {
        $in: ['IN_PROGRESS', 'WAITING_HARD_DELETE', 'HARD_DELETED'],
      },
    })

    return tenant != null
  }

  public async getTenantSettings(
    settingNames?: TenantSettingName[]
  ): Promise<Partial<TenantSettings>> {
    const cacheKey = getInMemoryCacheKey(this.tenantId, settingNames)
    if (tenantSettingsCache?.has(cacheKey)) {
      return tenantSettingsCache?.get(cacheKey) as TenantSettings
    }

    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
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

    if (envIs('test')) {
      settings.features = getTestEnabledFeatures()
    }

    tenantSettingsCache?.set(cacheKey, settings)
    return settings
  }

  public async createOrUpdateTenantSettings(
    newTenantSettings: Partial<TenantSettings>
  ): Promise<Partial<TenantSettings>> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ReturnValues: 'UPDATED_NEW',

      ...getUpdateAttributesUpdateItemInput(newTenantSettings),
    }

    await this.dynamoDb.send(new UpdateCommand(updateItemInput))

    return newTenantSettings
  }

  public async createPendingRecordForTenantDeletion(data: {
    tenantId: string
    triggeredByEmail: string
    triggeredById: string
    notRecoverable: boolean
  }): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Required<DeleteTenant>>(
      TENANT_DELETION_COLLECTION
    )
    await collection.insertOne({
      hardDeleteTimestamp: data.notRecoverable
        ? Date.now()
        : dayjs().add(45, 'day').unix(),
      createdTimestamp: Date.now(),
      updatedTimestamp: Date.now(),
      latestStatus: 'PENDING',
      statuses: [
        {
          status: 'PENDING',
          timestamp: Date.now(),
        },
      ],
      triggeredByEmail: data.triggeredByEmail,
      triggeredById: data.triggeredById,
      tenantId: data.tenantId,
      notRecoverable: data.notRecoverable ? true : false,
    })
  }

  public async isDeletetionRecordExists(
    tenantIdToDelete: string
  ): Promise<boolean> {
    const db = this.mongoDb.db()
    const collection = db.collection<DeleteTenant>(TENANT_DELETION_COLLECTION)
    const result = await collection.findOne({ tenantIdToDelete })
    return result !== null
  }

  public async deleteTenantSettings(
    settingNames: TenantSettingName[]
  ): Promise<void> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
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

  public async getTenantsDeletionData() {
    const db = this.mongoDb.db()
    const collection = db.collection<DeleteTenant>(TENANT_DELETION_COLLECTION)
    const [
      tenantsFailedToDelete,
      tenantsMarkedForDelete,
      tenantsDeletedRecently,
    ] = await Promise.all([
      collection.find({ latestStatus: 'FAILED' }).toArray(),
      collection
        .find({
          latestStatus: { $nin: ['FAILED', 'CANCELLED', 'HARD_DELETED'] },
        })
        .toArray(),
      collection
        .find({
          latestStatus: 'HARD_DELETED',
          updatedTimestamp: {
            $gte: dayjs().subtract(30, 'day').unix(),
          },
        })
        .toArray(),
    ])
    return {
      tenantIdsFailedToDelete: tenantsFailedToDelete.map(
        (tenant) => tenant.tenantId
      ),
      tenantIdsMarkedForDelete: tenantsMarkedForDelete.map(
        (tenant) => tenant.tenantId
      ),
      tenantIdsDeletedRecently: tenantsDeletedRecently.map(
        (tenant) => tenant.tenantId
      ),
    }
  }
}
