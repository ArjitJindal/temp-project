import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { WEBHOOK_COLLECTION } from '@/utils/mongodb-definitions'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { traceable } from '@/core/xray'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'

@traceable
export class WebhookRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async getWebhooksByEvents(
    events: WebhookEventType[]
  ): Promise<Map<WebhookEventType, WebhookConfiguration[]>> {
    const result: Map<WebhookEventType, WebhookConfiguration[]> = new Map()
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

    return {
      newImage: newWebhook,
      result: newWebhook,
      entityId: webhookId,
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

    return {
      newImage: result?.value as WebhookConfiguration,
      oldImage: webhook,
      entityId: webhook._id as string,
      result: undefined,
      logMetadata: { message },
    }
  }

  public async getWebhook(id: string): Promise<WebhookConfiguration | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    return collection.findOne({ _id: id })
  }

  public async getWebhooks(): Promise<WebhookConfiguration[]> {
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
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ _id: webhook._id })

    return {
      newImage: undefined,
      oldImage: webhook,
      entityId: webhook._id as string,
      result: undefined,
    }
  }
}
