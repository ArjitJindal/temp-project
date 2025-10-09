import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'

@traceable
export class ClickhouseWebhookRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private webhookTableName: string
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
    this.webhookTableName = CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName
  }
  public async getWebhooksByEvents(events: WebhookEventType[]) {
    const conditions: string[] = []
    conditions.push('is_deleted = 0')
    conditions.push(`hasAny(events, ['${events.join("','")}'])`)
    const query = `SELECT id FROM ${
      this.webhookTableName
    } FINAL WHERE ${conditions.join(' AND ')}`
    const result = await executeClickhouseQuery<{ id: string }[]>(
      this.clickhouseClient,
      query
    )
    return result.map((row) => row.id)
  }
  public async getWebhooks(): Promise<WebhookConfiguration[]> {
    const query = `SELECT data FROM ${this.webhookTableName} WHERE is_deleted = 0`
    const data = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      query
    )
    return data.map((result) => JSON.parse(result.data))
  }
}
