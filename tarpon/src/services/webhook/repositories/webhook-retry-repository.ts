import { MongoClient } from 'mongodb'
import { WebhookRetryTask } from '@/@types/webhook'
import { WEBHOOK_RETRY_COLLECTION } from '@/utils/mongodb-definitions'

export class WebhookRetryRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb
    this.tenantId = tenantId
  }

  async getWebhookRetryEvent(
    eventId: string
  ): Promise<WebhookRetryTask | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookRetryTask>(
      WEBHOOK_RETRY_COLLECTION(this.tenantId)
    )

    return collection.findOne({ eventId })
  }

  async addOrUpdateWebhookRetryEvent(event: WebhookRetryTask): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookRetryTask>(
      WEBHOOK_RETRY_COLLECTION(this.tenantId)
    )

    await collection.updateOne(
      { eventId: event.eventId },
      { $set: event },
      { upsert: true }
    )
  }

  async getAllWebhookRetryEvents(
    retryAfter?: number
  ): Promise<WebhookRetryTask[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookRetryTask>(
      WEBHOOK_RETRY_COLLECTION(this.tenantId)
    )

    return collection
      .find({ retryAfter: { $lte: retryAfter || Date.now() } })
      .toArray()
  }

  async countWebhookRetryEvents(retryAfter?: number): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookRetryTask>(
      WEBHOOK_RETRY_COLLECTION(this.tenantId)
    )

    return collection.countDocuments({
      retryAfter: { $lte: retryAfter || Date.now() },
    })
  }

  async deleteWebhookRetryEvent(eventId: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookRetryTask>(
      WEBHOOK_RETRY_COLLECTION(this.tenantId)
    )

    await collection.deleteOne({ eventId })
  }
}
