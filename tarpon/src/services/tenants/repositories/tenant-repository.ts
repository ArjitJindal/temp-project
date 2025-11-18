import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { DynamoDbKeys, TenantSettingName } from '@/core/dynamodb/dynamodb-keys'
import { getUpdateAttributesUpdateItemInput } from '@/utils/dynamodb'
import {
  TENANT_DELETION_COLLECTION,
  METADATA_COLLECTION,
} from '@/utils/mongo-table-names'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'
import { getTestEnabledFeatures } from '@/core/utils/context'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import dayjs from '@/utils/dayjs'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

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

  public async getSecondaryQueueTenants(): Promise<string[]> {
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Key: DynamoDbKeys.SECONDARY_QUEUE_TENANTS(),
      })
    )

    return result.Item?.secondaryQueueTenants ?? []
  }

  public async setSecondaryQueueTenants(tenants: string[]): Promise<void> {
    await this.dynamoDb.send(
      new PutCommand({
        TableName:
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(FLAGRIGHT_TENANT_ID),
        Item: {
          ...DynamoDbKeys.SECONDARY_QUEUE_TENANTS(),
          secondaryQueueTenants: tenants,
        },
      })
    )
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
    const setExpressions: string[] = []
    const removeExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    // Handle workflowSettings separately (needs special handling for nested objects)
    const { workflowSettings, ...otherSettings } = newTenantSettings

    if (workflowSettings !== undefined) {
      // Read existing workflowSettings to merge with new values
      const existingSettings = await this.getTenantSettings([
        'workflowSettings',
      ])
      const existingWorkflowSettings = existingSettings.workflowSettings || {}

      // Merge new workflowSettings with existing ones
      // Special handling: userApprovalWorkflows should be replaced entirely, not merged
      const mergedWorkflowSettings: Record<string, any> = {
        ...existingWorkflowSettings,
      }

      // Apply new settings, replacing userApprovalWorkflows entirely if provided
      for (const [key, value] of Object.entries(workflowSettings)) {
        if (
          key === 'userApprovalWorkflows' &&
          value !== null &&
          value !== undefined
        ) {
          // Replace entirely - don't merge with existing
          mergedWorkflowSettings[key] = value
        } else {
          // For other fields, merge normally
          mergedWorkflowSettings[key] = value
        }
      }

      // Clean merged workflowSettings: remove null/undefined values and nested null values
      const cleanedWorkflowSettings: Record<string, any> = {}
      for (const [key, value] of Object.entries(mergedWorkflowSettings)) {
        if (value === null || value === undefined) {
          continue
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For nested objects, just filter out null/undefined values (don't merge again)
          const cleanedObject = Object.fromEntries(
            Object.entries(value).filter(
              ([, v]) => v !== null && v !== undefined
            )
          )
          if (Object.keys(cleanedObject).length > 0) {
            cleanedWorkflowSettings[key] = cleanedObject
          }
        } else {
          cleanedWorkflowSettings[key] = value
        }
      }

      // Either SET or REMOVE workflowSettings based on whether it has any values
      expressionAttributeNames['#ws'] = 'workflowSettings'
      if (Object.keys(cleanedWorkflowSettings).length > 0) {
        setExpressions.push('#ws = :ws')
        expressionAttributeValues[':ws'] = cleanedWorkflowSettings
      } else {
        removeExpressions.push('#ws')
      }
    }

    // Handle all other settings using the standard update function
    if (Object.keys(otherSettings).length > 0) {
      const otherUpdate = getUpdateAttributesUpdateItemInput(otherSettings)

      // Extract SET expressions from the other update (format: "SET key1 = :key1, key2 = :key2")
      const otherSetClause = otherUpdate.UpdateExpression.replace(
        /^SET\s+/,
        ''
      ).trim()
      if (otherSetClause) {
        setExpressions.push(otherSetClause)
      }

      Object.assign(
        expressionAttributeValues,
        otherUpdate.ExpressionAttributeValues
      )
    }

    // Build the final UpdateExpression
    const updateExpressionParts: string[] = []
    if (setExpressions.length > 0) {
      updateExpressionParts.push(`SET ${setExpressions.join(', ')}`)
    }
    if (removeExpressions.length > 0) {
      updateExpressionParts.push(`REMOVE ${removeExpressions.join(', ')}`)
    }

    if (updateExpressionParts.length === 0) {
      // No updates to perform
      return newTenantSettings
    }

    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.TENANT_SETTINGS(this.tenantId),
      ReturnValues: 'UPDATED_NEW',
      UpdateExpression: updateExpressionParts.join(' '),
      ExpressionAttributeValues:
        Object.keys(expressionAttributeValues).length > 0
          ? expressionAttributeValues
          : undefined,
      ExpressionAttributeNames:
        Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
    }

    await this.dynamoDb.send(new UpdateCommand(updateItemInput))

    return newTenantSettings
  }

  public async createPendingRecordForTenantDeletion(data: {
    tenantId: string
    tenantName: string
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
      tenantName: data.tenantName,
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
      tenantIdsFailedToDelete: tenantsFailedToDelete.map((tenant) => ({
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
      })),
      tenantIdsMarkedForDelete: tenantsMarkedForDelete.map((tenant) => ({
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
      })),
      tenantIdsDeletedRecently: tenantsDeletedRecently.map((tenant) => ({
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
      })),
    }
  }
}
