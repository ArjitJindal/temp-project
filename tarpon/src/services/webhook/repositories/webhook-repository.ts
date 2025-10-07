import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { captureMessage } from '@sentry/node'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickhouseWebhookRepository } from './clickhouse-webhook-repository'
import { DynamoWebhookRepository } from './dynamo-webhook-repository'
import { WEBHOOK_COLLECTION } from '@/utils/mongo-table-names'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { traceable } from '@/core/xray'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { batchInsertToClickhouse } from '@/utils/clickhouse/insert'
import {
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { getDynamoDbClient } from '@/utils/dynamodb'

@traceable
export class WebhookRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  clickhouseWebhookRepository?: ClickhouseWebhookRepository
  dynamoWebhookRepository: DynamoWebhookRepository
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb as MongoClient
    this.tenantId = tenantId
    this.dynamoDb = getDynamoDbClient()
    this.dynamoWebhookRepository = new DynamoWebhookRepository(
      tenantId,
      this.dynamoDb
    )
  }
  private async getClickhouseWebhookRepository() {
    if (this.clickhouseWebhookRepository) {
      return this.clickhouseWebhookRepository
    }
    this.clickhouseWebhookRepository = new ClickhouseWebhookRepository(
      this.tenantId,
      {
        clickhouseClient: await getClickhouseClient(this.tenantId),
        dynamoDb: this.dynamoDb,
      }
    )
    return this.clickhouseWebhookRepository
  }
  public async getWebhooksByEvents(
    events: WebhookEventType[]
  ): Promise<Map<WebhookEventType, WebhookConfiguration[]>> {
    const result: Map<WebhookEventType, WebhookConfiguration[]> = new Map()
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookRepository =
        await this.getClickhouseWebhookRepository()
      const ids = await clickhouseWebhookRepository.getWebhooksByEvents(
        events as WebhookEventType[]
      )
      const webhooks = await this.dynamoWebhookRepository.getWebhookFromIds(ids)
      webhooks.forEach((webhook) => {
        webhook.events?.forEach((event) => {
          if (result.has(event)) {
            result.get(event)?.push(webhook)
          } else {
            result.set(event, [webhook])
          }
        })
      })
      return result
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    const webhooksCursor = collection.find({
      enabled: true,
      events: { $in: events },
    })
    for await (const webhook of webhooksCursor) {
      webhook.events?.forEach((event) => {
        if (result.has(event)) {
          result.get(event)?.push(webhook)
        } else {
          result.set(event, [webhook])
        }
      })
    }
    return result
  }

  @auditLog('WEBHOOK', 'WEBHOOK', 'CREATE')
  public async saveWebhook(
    webhook: WebhookConfiguration
  ): Promise<AuditLogReturnData<WebhookConfiguration>> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    const existingWebhook = webhook._id
      ? await this.getWebhook(webhook._id)
      : null
    const webhookId = webhook._id ?? uuidv4()
    const newWebhook: WebhookConfiguration = {
      _id: webhookId,
      createdAt: webhook.createdAt ?? Date.now(),
      webhookUrl: webhook.webhookUrl,
      events: webhook.events,
      enabled: webhook.enabled ?? true,
      enabledAt:
        webhook.enabledAt ??
        (!existingWebhook?.enabled && webhook.enabled
          ? Date.now()
          : existingWebhook?.enabledAt),
      autoDisableMessage: '',
    }

    await collection.replaceOne({ _id: newWebhook._id }, newWebhook, {
      upsert: true,
    })
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoWebhookRepository.saveWebhook(newWebhook)
    }

    return {
      result: newWebhook,
      entities: [
        {
          newImage: newWebhook,
          entityId: webhookId,
        },
      ],
    }
  }

  @auditLog('WEBHOOK', 'WEBHOOK', 'UPDATE')
  public async disableWebhook(
    webhook: WebhookConfiguration,
    message: string
  ): Promise<AuditLogReturnData<void>> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )

    const result = await collection.findOneAndUpdate(
      { _id: webhook._id },
      { $set: { enabled: false, autoDisableMessage: message } }
    )
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoWebhookRepository.disableWebhook(
        webhook._id as string,
        message
      )
    }
    captureMessage(`Webhook ${webhook._id} disabled by ${message}`, {
      level: 'info',
    })

    return {
      entities: [
        {
          newImage: result?.value as WebhookConfiguration,
          oldImage: webhook,
          entityId: webhook._id as string,
          logMetadata: { message },
        },
      ],
      result: undefined,
    }
  }

  public async getWebhook(id: string): Promise<WebhookConfiguration | null> {
    if (isClickhouseMigrationEnabled()) {
      return await this.dynamoWebhookRepository.getWebhook(id)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    return collection.findOne({ _id: id })
  }

  public async getWebhooks(): Promise<WebhookConfiguration[]> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookRepository =
        await this.getClickhouseWebhookRepository()
      const webhooks = await clickhouseWebhookRepository.getWebhooks()
      return webhooks
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    return collection.find({}).toArray()
  }

  @auditLog('WEBHOOK', 'WEBHOOK', 'DELETE')
  public async deleteWebhook(
    webhook: WebhookConfiguration
  ): Promise<AuditLogReturnData<void>> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoWebhookRepository.deleteWebhook(webhook._id as string)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ _id: webhook._id })

    return {
      entities: [
        {
          oldImage: webhook,
          entityId: webhook._id as string,
        },
      ],
      result: undefined,
    }
  }
  public async linkWebhookClickhouse(
    webhook: WebhookConfiguration
  ): Promise<void> {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName,
      [webhook]
    )
  }
}
