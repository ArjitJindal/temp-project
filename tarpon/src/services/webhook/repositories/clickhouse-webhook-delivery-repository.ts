import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/WebhookDeliveryAttempt'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { DefaultApiGetWebhooksWebhookIdDeliveriesRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE, offsetPaginateClickhouse } from '@/utils/pagination'

@traceable
export class ClickhouseWebhookDeliveryRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private webhookDeliveryTableName: string
  constructor(
    tenantId: string,
    connections: {
      clickhouseClient: ClickHouseClient
      dynamoDb: DynamoDBDocumentClient
    }
  ) {
    this.tenantId = tenantId
    this.clickhouseClient = connections.clickhouseClient
    this.dynamoDb = connections.dynamoDb
    this.webhookDeliveryTableName =
      CLICKHOUSE_DEFINITIONS.WEBHOOK_DELIVERIES.tableName
  }
  public async getLatestWebhookDeliveryAttempt(
    deliveryTaskId: string
  ): Promise<WebhookDeliveryAttempt | null> {
    const query = `
      SELECT data
      FROM ${this.webhookDeliveryTableName} FINAL
      WHERE deliveryTaskId = '${deliveryTaskId}'
      ORDER BY deliveredAt DESC
      LIMIT 1
    `
    const result = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      query
    )
    return result.length > 0
      ? (JSON.parse(result[0].data) as WebhookDeliveryAttempt)
      : null
  }
  public async getFirstWebhookDeliveryAttempt(
    deliveryTaskId: string
  ): Promise<WebhookDeliveryAttempt | null> {
    const query = `
      SELECT data
      FROM ${this.webhookDeliveryTableName} FINAL
      WHERE deliveryTaskId = '${deliveryTaskId}'
      ORDER BY deliveredAt ASC
      LIMIT 1
    `
    const result = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      query
    )
    return result.length > 0
      ? (JSON.parse(result[0].data) as WebhookDeliveryAttempt)
      : null
  }
  private getWebhookDeliveryAttemptsConditions(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ) {
    const conditions: string[] = []
    conditions.push('is_deleted = 0')
    conditions.push(`webhookId = '${webhookId}'`)
    if (params.filterStatus != null) {
      conditions.push(`success = ${params.filterStatus === 'true'}`)
    }
    if (
      params.filterEventCreatedAtAfterTimestamp != null ||
      params.filterEventCreatedAtBeforeTimestamp != null
    ) {
      conditions.push(
        `eventCreatedAt between ${params.filterEventCreatedAtAfterTimestamp} and ${params.filterEventCreatedAtBeforeTimestamp}`
      )
    }
    if (
      params.filterEventDeliveredAtAfterTimestamp != null ||
      params.filterEventDeliveredAtBeforeTimestamp != null
    ) {
      conditions.push(
        `deliveredAt between ${params.filterEventDeliveredAtAfterTimestamp} and ${params.filterEventDeliveredAtBeforeTimestamp}`
      )
    }
    if (params.filterEventType != null) {
      conditions.push(`event = '${params.filterEventType}'`)
    }
    if (params.manualRetry != null) {
      conditions.push(`manualRetry = ${params.manualRetry === 'true'}`)
    }
    if (params.searchEntityId && params.searchEntityId.length > 0) {
      if (!params.entityIdExactMatch) {
        conditions.push(`entityId ILIKE '${params.searchEntityId}%'`)
      } else {
        conditions.push(
          `entityId IN (${params.searchEntityId
            .map((id) => `'${id}'`)
            .join(',')})`
        )
      }
    }
    return conditions.join(' AND ')
  }
  public async getWebhookDeliveryCount(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ): Promise<number> {
    const conditions = this.getWebhookDeliveryAttemptsConditions(
      webhookId,
      params
    )
    const query = `
      SELECT count() as count
      FROM ${this.webhookDeliveryTableName} FINAL
      WHERE ${conditions}
    `
    const result = await executeClickhouseQuery<{ count: number }[]>(
      this.clickhouseClient,
      query
    )
    return result[0].count
  }
  public async getWebhookDeliveryAttempts(
    webhookId: string,
    params: DefaultApiGetWebhooksWebhookIdDeliveriesRequest
  ) {
    const conditions = this.getWebhookDeliveryAttemptsConditions(
      webhookId,
      params
    )
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number
    const sortOrder = params.sortOrder ?? 'descend'
    const { items } = await offsetPaginateClickhouse(
      this.clickhouseClient,
      this.webhookDeliveryTableName,
      this.webhookDeliveryTableName,
      {
        pageSize,
        page,
        sortField: 'requestFinishedAt',
        sortOrder,
      },
      conditions,
      { data: 'data' },
      (item) => JSON.parse(item.data as string) as WebhookDeliveryAttempt
    )

    return items
  }
}
