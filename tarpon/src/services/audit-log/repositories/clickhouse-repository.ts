import { ClickHouseClient } from '@clickhouse/client'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import {
  batchInsertToClickhouse,
  executeClickhouseQuery,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE, offsetPaginateClickhouse } from '@/utils/pagination'

const AUDIT_LOGS_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName
@traceable
export class ClickhouseAuditLogRepository {
  private readonly tenantId: string
  private readonly clickhouseClient: ClickHouseClient
  private readonly tableName: string

  constructor(
    tenantId: string,
    connections: {
      clickhouseClient: ClickHouseClient
    }
  ) {
    this.tenantId = tenantId
    this.clickhouseClient = connections.clickhouseClient
    this.tableName = AUDIT_LOGS_TABLE_NAME_CH
  }
  public async saveAuditLog(auditLogs: AuditLog[]): Promise<void> {
    await batchInsertToClickhouse(this.tenantId, this.tableName, auditLogs)
  }
  public async getAuditLogById(auditlogId: string): Promise<AuditLog> {
    const client = await getClickhouseClient(this.tenantId)
    const query = `SELECT data FROM ${this.tableName} WHERE auditlogId = '${auditlogId}'`
    const result = await executeClickhouseQuery<{ data: AuditLog }>(
      client,
      query
    )
    return (result[0]?.data as AuditLog) ?? null
  }

  public async getAuditLogCount(
    params: DefaultApiGetAuditlogRequest
  ): Promise<number> {
    const client = await getClickhouseClient(this.tenantId)
    const query = `SELECT COUNT(*) as count FROM ${
      this.tableName
    } WHERE ${this.getAuditLogsWhereConditions(params)}`
    const data = await executeClickhouseQuery<{ count: number }>(client, query)
    return Number(data[0]?.count ?? 0)
  }

  private getAuditLogsWhereConditions(
    params: DefaultApiGetAuditlogRequest
  ): string {
    const conditions: string[] = []

    if (params.afterTimestamp != null) {
      conditions.push(`timestamp >= ${params.afterTimestamp}`)
    }
    if (params.beforeTimestamp != null) {
      conditions.push(`timestamp <= ${params.beforeTimestamp}`)
    }
    if (params.includeRootUserRecords !== true) {
      conditions.push(`userRole != 'root'`)
    }

    if (params.filterTypes?.length) {
      conditions.push(`type IN ('${params.filterTypes.join("','")}')`)
    }

    if (
      params.searchEntityId &&
      params.searchEntityId.length > 0 &&
      !params.entityIdExactMatch
    ) {
      conditions.push(`entityId ILIKE '${params.searchEntityId}'`)
    }

    if (params.searchEntityId && params.entityIdExactMatch) {
      conditions.push(`entityId IN ('${params.searchEntityId.join("','")}')`)
    }

    if (params.caseStatus && params.caseStatus.length) {
      conditions.push(
        `subtype = 'STATUS_CHANGE' AND newImageCaseStatus IN ('${params.caseStatus.join(
          "','"
        )}')`
      )
    }

    if (params.alertStatus && params.alertStatus.length) {
      conditions.push(
        `subtype = 'STATUS_CHANGE' AND newImageAlertStatus IN ('${params.alertStatus.join(
          "','"
        )}')`
      )
    }

    if (params.filterActionTakenBy != null) {
      conditions.push(`userId IN ('${params.filterActionTakenBy.join("','")}')`)
    }

    if (params.filterActions?.length) {
      conditions.push(`action IN ('${params.filterActions.join("','")}')`)
    }
    return conditions.join(' AND ')
  }

  public async getAllAuditLogs(
    params: DefaultApiGetAuditlogRequest
  ): Promise<{ total: number; data: AuditLog[] }> {
    const whereClause = await this.getAuditLogsWhereConditions(params)
    const sortField = params.sortField ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'descend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const { items, count } = await offsetPaginateClickhouse(
      this.clickhouseClient,
      this.tableName,
      this.tableName,
      {
        pageSize,
        page,
        sortField,
        sortOrder,
      },
      whereClause,
      { data: 'data' },
      (item) => JSON.parse(item.data as string) as AuditLog
    )

    return {
      total: count,
      data: items as AuditLog[],
    }
  }
}
