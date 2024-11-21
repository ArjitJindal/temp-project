import { Filter, MongoClient } from 'mongodb'
import { WEBHOOK_DELIVERY_COLLECTION } from '@/utils/mongodb-definitions'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'
import { traceable } from '@/core/xray'
import { DefaultApiGetWebhooksWebhookIdDeliveriesRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { WebhookEventType } from '@/@types/openapi-internal/WebhookEventType'

@traceable
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

  public async getFirstWebhookDeliveryAttempt(
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
      .sort({ deliveredAt: 1 })
      .limit(1)
      .next()
  }

  public async getWebhookDeliveryAttempts(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<WebhookDeliveryAttempt[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )

    const query: Filter<WebhookDeliveryAttempt> = {
      webhookId,
    }

    if (params.filterStatus != null) {
      query.success = params.filterStatus === 'true'
    }

    if (
      params.filterEventCreatedAtAfterTimestamp != null ||
      params.filterEventCreatedAtBeforeTimestamp != null
    ) {
      query.eventCreatedAt = {
        $gte: params.filterEventCreatedAtAfterTimestamp,
        $lte: params.filterEventCreatedAtBeforeTimestamp,
      }
    }

    if (
      params.filterEventDeliveredAtAfterTimestamp != null ||
      params.filterEventDeliveredAtBeforeTimestamp != null
    ) {
      query.deliveredAt = {
        $gte: params.filterEventDeliveredAtAfterTimestamp,
        $lte: params.filterEventDeliveredAtBeforeTimestamp,
      }
    }

    if (params.filterEventType != null) {
      query.event = params.filterEventType as WebhookEventType
    }

    const skip =
      ((params.page || 1) - 1) * (params.pageSize || DEFAULT_PAGE_SIZE)

    const limit = params.pageSize || DEFAULT_PAGE_SIZE

    return collection
      .find(query)
      .sort({ requestStartedAt: -1 })
      .limit(limit)
      .skip(skip)
      .toArray()
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
