import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { WEBHOOK_COLLECTION } from '@/utils/mongoDBUtils'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
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

  public async saveWebhook(
    webhook: WebhookConfiguration
  ): Promise<WebhookConfiguration> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    const newWebhook: WebhookConfiguration = {
      _id: webhook._id ?? uuidv4(),
      createdAt: webhook.createdAt ?? Date.now(),
      webhookUrl: webhook.webhookUrl,
      events: webhook.events,
      enabled: webhook.enabled ?? true,
      retryCount: 0,
    }
    await collection.replaceOne({ _id: newWebhook._id }, newWebhook, {
      upsert: true,
    })
    return newWebhook
  }

  public async disableWebhook(id: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.findOneAndUpdate(
      { _id: id },
      { $set: { enabled: false, retryCount: 0 } }
    )
  }

  public async incrementRetryCount(id: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )

    await collection.findOneAndUpdate({ _id: id }, { $inc: { retryCount: 1 } })
  }

  public async resetRetryCount(id: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.findOneAndUpdate({ _id: id }, { $set: { retryCount: 0 } })
  }

  public async getRetryCount(id: string): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    const webhook = await collection.findOne({ _id: id })
    return webhook?.retryCount ?? 0
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

  public async deleteWebhook(id: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ _id: id })
  }
}
