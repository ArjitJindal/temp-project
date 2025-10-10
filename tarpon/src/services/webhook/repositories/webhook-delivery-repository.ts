import { Filter, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickhouseWebhookDeliveryRepository } from './clickhouse-webhook-delivery-repository'
import { WEBHOOK_DELIVERY_COLLECTION } from '@/utils/mongo-table-names'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'
import { traceable } from '@/core/xray'
import { DefaultApiGetWebhooksWebhookIdDeliveriesRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { WebhookEventType } from '@/@types/openapi-internal/WebhookEventType'
import { prefixRegexMatchFilterForArray } from '@/utils/mongodb-utils'
import { batchInsertToClickhouse } from '@/utils/clickhouse/insert'
import {
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { getDynamoDbClient } from '@/utils/dynamodb'
@traceable
export class WebhookDeliveryRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  clickhouseWebhookDeliveryRepository?: ClickhouseWebhookDeliveryRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb as MongoClient
    this.tenantId = tenantId
    this.dynamoDb = getDynamoDbClient()
  }
  private async getClickhouseWebhookDeliveryRepository() {
    if (this.clickhouseWebhookDeliveryRepository) {
      return this.clickhouseWebhookDeliveryRepository
    }
    this.clickhouseWebhookDeliveryRepository =
      new ClickhouseWebhookDeliveryRepository(this.tenantId, {
        clickhouseClient: await getClickhouseClient(this.tenantId),
        dynamoDb: this.dynamoDb,
      })
    return this.clickhouseWebhookDeliveryRepository
  }
  public async getLatestWebhookDeliveryAttempt(
    deliveryTaskId: string
  ): Promise<WebhookDeliveryAttempt | null> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookDeliveryRepository =
        await this.getClickhouseWebhookDeliveryRepository()
      return await clickhouseWebhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
        deliveryTaskId
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookDeliveryRepository =
        await this.getClickhouseWebhookDeliveryRepository()
      return await clickhouseWebhookDeliveryRepository.getFirstWebhookDeliveryAttempt(
        deliveryTaskId
      )
    }
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
  private async getWebhookDeliveryAttemptsAggregation(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<any[]> {
    const matchStage: any = {
      $match: { webhookId },
    }

    if (params.filterStatus != null) {
      matchStage.$match.success = params.filterStatus === 'true'
    }

    if (
      params.filterEventCreatedAtAfterTimestamp != null ||
      params.filterEventCreatedAtBeforeTimestamp != null
    ) {
      matchStage.$match.eventCreatedAt = {}
      if (params.filterEventCreatedAtAfterTimestamp != null) {
        matchStage.$match.eventCreatedAt.$gte =
          params.filterEventCreatedAtAfterTimestamp
      }
      if (params.filterEventCreatedAtBeforeTimestamp != null) {
        matchStage.$match.eventCreatedAt.$lte =
          params.filterEventCreatedAtBeforeTimestamp
      }
    }

    if (
      params.filterEventDeliveredAtAfterTimestamp != null ||
      params.filterEventDeliveredAtBeforeTimestamp != null
    ) {
      matchStage.$match.deliveredAt = {}
      if (params.filterEventDeliveredAtAfterTimestamp != null) {
        matchStage.$match.deliveredAt.$gte =
          params.filterEventDeliveredAtAfterTimestamp
      }
      if (params.filterEventDeliveredAtBeforeTimestamp != null) {
        matchStage.$match.deliveredAt.$lte =
          params.filterEventDeliveredAtBeforeTimestamp
      }
    }

    if (params.filterEventType != null) {
      matchStage.$match.event = params.filterEventType as WebhookEventType
    }

    return [
      matchStage,
      {
        $group: {
          _id: '$deliveryTaskId',
          parent: { $first: '$$ROOT' },
          attempts: { $push: '$$ROOT' },
          hasSuccess: { $max: { $cond: ['$success', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          deliveryTaskId: '$_id',
          webhookId: '$parent.webhookId',
          webhookUrl: '$parent.webhookUrl',
          requestStartedAt: '$parent.requestStartedAt',
          requestFinishedAt: '$parent.requestFinishedAt',
          event: '$parent.event',
          eventCreatedAt: '$parent.eventCreatedAt',
          request: '$parent.request',
          response: '$parent.response',
          overallSuccess: { $gt: ['$hasSuccess', 0] },
          attempts: {
            $sortArray: {
              input: '$attempts',
              sortBy: { requestStartedAt: -1 },
            },
          },
        },
      },
    ]
  }

  private async getWebhookDeliveryAttemptsFilter(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<Filter<WebhookDeliveryAttempt>> {
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

    if (params.manualRetry != null) {
      query.manualRetry = params.manualRetry === 'true'
    }

    if (params.searchEntityId && params.searchEntityId.length > 0) {
      if (!params.entityIdExactMatch) {
        const searchEntityIdRegex = prefixRegexMatchFilterForArray(
          params.searchEntityId,
          true
        )
        query.entityId = searchEntityIdRegex
      } else {
        query.entityId = {
          $in: params.searchEntityId,
        }
      }
    }
    return query
  }

  public async getWebhookDeliveryAttempts(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<WebhookDeliveryAttempt[]> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookDeliveryRepository =
        await this.getClickhouseWebhookDeliveryRepository()
      return await clickhouseWebhookDeliveryRepository.getWebhookDeliveryAttempts(
        webhookId,
        params
      )
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )
    const pipeline = await this.getWebhookDeliveryAttemptsAggregation(
      webhookId,
      params
    )
    const skip =
      ((params.page || 1) - 1) * (params.pageSize || DEFAULT_PAGE_SIZE)
    const limit = params.pageSize || DEFAULT_PAGE_SIZE
    pipeline.push(
      { $sort: { requestStartedAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    )
    return (await collection
      .aggregate(pipeline)
      .toArray()) as WebhookDeliveryAttempt[]
  }

  public async getWebhookDeliveryCount(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<number> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseWebhookDeliveryRepository =
        await this.getClickhouseWebhookDeliveryRepository()
      return await clickhouseWebhookDeliveryRepository.getWebhookDeliveryCount(
        webhookId,
        {
          ...params,
          manualRetry: 'false',
        }
      )
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )
    const query = await this.getWebhookDeliveryAttemptsFilter(webhookId, {
      ...params,
      manualRetry: 'false',
    })
    return collection.countDocuments(query)
  }

  public async addWebhookDeliveryAttempt(
    deliveryAttempt: WebhookDeliveryAttempt
  ): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.linkWebhookDeliveryClickhouse([deliveryAttempt])
    }
    const db = this.mongoDb.db()
    const collection = db.collection<WebhookDeliveryAttempt>(
      WEBHOOK_DELIVERY_COLLECTION(this.tenantId)
    )
    await collection.insertOne(deliveryAttempt)
  }
  public async linkWebhookDeliveryClickhouse(
    deliveryAttempts: WebhookDeliveryAttempt[]
  ): Promise<void> {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.WEBHOOK_DELIVERIES.tableName,
      deliveryAttempts
    )
  }
}
