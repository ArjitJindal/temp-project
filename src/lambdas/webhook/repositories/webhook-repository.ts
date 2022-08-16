import { MongoClient } from 'mongodb'
import { WEBHOOK_COLLECTION } from '@/utils/mongoDBUtils'
import { WebhookConfiguration, WebhookEventType } from '@/@types/webhook'

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
      webhook.events.forEach((event) => {
        if (result.has(event)) {
          result.get(event)?.push(webhook)
        } else {
          result.set(event, [webhook])
        }
      })
    }
    return result
  }

  public async addWebhook(webhook: WebhookConfiguration): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(this.tenantId)
    )
    await collection.insertOne(webhook)
  }
}
