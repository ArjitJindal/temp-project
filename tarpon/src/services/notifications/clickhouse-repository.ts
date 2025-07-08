import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { Notification } from '@/@types/openapi-internal/Notification'
import { DefaultApiGetNotificationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { offsetPaginateClickhouseWithoutDataTable } from '@/utils/pagination'

@traceable
export class ClickhouseNotificationRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private notificationsClickHouseTableName: string
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
    this.notificationsClickHouseTableName =
      CLICKHOUSE_DEFINITIONS.NOTIFICATIONS.tableName
  }
  public async getNotificationsByRecipient(
    recipient: string
  ): Promise<Notification[]> {
    const query = `
    SELECT data FROM 
    ${this.notificationsClickHouseTableName} FINAL
    WHERE arrayExists(x -> x = '${recipient}', recievers)`
    const result = await executeClickhouseQuery<any[]>(this.tenantId, {
      query,
      format: 'JSONEachRow',
    })
    const data = result.map((r) => JSON.parse(r.data))
    return data
  }
  private getConsoleNotificationsQuery(
    accountId: string,
    params: DefaultApiGetNotificationsRequest
  ): string {
    const conditions: string[] = []
    if (params.notificationStatus === 'UNREAD') {
      conditions.push(`
          arrayExists(statusItem -> statusItem.3 = '${accountId}' AND statusItem.1 = 'SENT', 
                     consoleNotificationStatuses)
        `)
    }
    return conditions.join(' AND ')
  }
  public async getConsoleNotifications(
    accountId: string,
    params: DefaultApiGetNotificationsRequest
  ): Promise<{
    items: string[]
    next: string
    prev: string
    hasNext: boolean
    hasPrev: boolean
    count: number
    limit: number
    last: string
  }> {
    const whereConditions = this.getConsoleNotificationsQuery(accountId, params)
    const page = params.start ? parseInt(params.start) : 1
    const pageSize = 50

    const { items, count } = await offsetPaginateClickhouseWithoutDataTable(
      this.clickhouseClient,
      this.notificationsClickHouseTableName,
      {
        pageSize,
        page,
        sortField: 'createdAt',
        sortOrder: 'descend',
      },
      whereConditions
    )

    const totalPages = Math.ceil(count / pageSize)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      items: items.map((item) => item.id),
      next: hasNext ? (page + 1).toString() : '',
      prev: hasPrev ? (page - 1).toString() : '',
      hasPrev,
      hasNext,
      count,
      limit: pageSize,
      last: totalPages.toString(),
    }
  }
}
