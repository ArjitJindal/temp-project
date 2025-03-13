import { ClickHouseClient } from '@clickhouse/client'
import { AlertParams } from './repository'
import { Alert } from '@/@types/openapi-internal/Alert'
import { DEFAULT_PAGE_SIZE, offsetPaginateClickhouse } from '@/utils/pagination'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'

export interface AlertClickhouse extends Alert {
  caseStatus?: string
}

type StatusChanges = {
  statusChanges: CaseStatusChange[]
}

export class ClickhouseAlertRepository {
  private clickhouseClient: ClickHouseClient

  constructor(clickhouseClient: ClickHouseClient) {
    this.clickhouseClient = clickhouseClient
  }

  async getAlertsForInvestigationTimes(
    ruleInstanceId: string,
    afterTimestamp: number,
    beforeTimestamp: number
  ) {
    const query = `SELECT alerts.statusChanges as statusChanges FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} array join alerts WHERE alerts.ruleInstanceId = '${ruleInstanceId}' AND alerts.createdTimestamp >= ${afterTimestamp} AND alerts.createdTimestamp <= ${beforeTimestamp}`

    const statusChangesData = await executeClickhouseQuery<StatusChanges[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )

    return statusChangesData
  }

  async getAlerts(
    params: AlertParams
  ): Promise<{ data: { id: string }[]; total: number }> {
    const query = await this.getWhereConditions(params)
    const result = await offsetPaginateClickhouse<{
      id: string
    }>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
      CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
      {
        pageSize:
          typeof params.pageSize === 'number'
            ? params.pageSize
            : DEFAULT_PAGE_SIZE,
        page: params.page ?? 1,
        sortField: params.sortField ?? 'id',
        sortOrder: params.sortOrder ?? 'ascend',
      },
      query,
      { id: 'id' }
    )

    return {
      data: result.items,
      total: result.count,
    }
  }

  async getWhereConditions(params: AlertParams): Promise<string> {
    const whereConditions: string[] = []

    if (params.filterOutCaseStatus != null) {
      whereConditions.push(
        `alertStatus NOT IN ('${params.filterOutCaseStatus.join("','")}')`
      )
    }

    if (params.filterOutAlertStatus != null) {
      whereConditions.push(
        `alertStatus IN ('${params.filterOutAlertStatus.join("','")}')`
      )
    }

    if (params.filterCaseStatus != null) {
      whereConditions.push(
        `caseStatus IN ('${params.filterCaseStatus.join("','")}')`
      )
    }

    if (params.filterAlertStatus != null) {
      whereConditions.push(
        `alertStatus IN ('${params.filterAlertStatus.join("','")}')`
      )
    }

    return whereConditions.join(' AND ')
  }
}
