import { MongoClient } from 'mongodb'
import { WEBHOOK_DELIVERY_COLLECTION } from '@/utils/mongoDBUtils'
import { WebhookDeliveryAttempt } from '@/@types/webhook'

export class WebhookDeliveryRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async getLatestWebhookDeliveryAttempt(
    deliveryTaskId: string
  ): Promise<WebhookDeliveryAttempt | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )
    return collection
      .find({
        deliveryTaskId,
      })
      .sort({ deliveredAt: -1 })
      .limit(1)
      .next()
  }

  public async addWebhookDeliveryAttempt(
    deliveryAttempt: WebhookDeliveryAttempt
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )
    await collection.insertOne(deliveryAttempt)
  }
}
