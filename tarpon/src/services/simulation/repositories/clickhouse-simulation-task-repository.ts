import { ClickHouseClient } from '@clickhouse/client'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import {
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouseWithoutDataTable,
} from '@/utils/pagination'
@traceable
export class ClickhouseSimulationTaskRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private simulationTaskTableName: string
  constructor(
    tenantId: string,
    connections: {
      clickhouseClient: ClickHouseClient
    }
  ) {
    this.tenantId = tenantId
    this.clickhouseClient = connections.clickhouseClient
    this.simulationTaskTableName =
      CLICKHOUSE_DEFINITIONS.SIMULATION_TASK.tableName
  }
  public async getSimulationJobsCount(): Promise<number> {
    const query = `SELECT count() as count FROM ${this.simulationTaskTableName} WHERE internal != true AND is_deleted = 0`
    const result = await executeClickhouseQuery<{ count: number }>(
      this.tenantId,
      query
    )
    return result[0].count
  }
  private getSimulationJobsWhereConditions(
    params: DefaultApiGetSimulationsRequest
  ): string {
    const conditions: string[] = []
    conditions.push('is_deleted = 0')
    if (params.type) {
      conditions.push(`type = '${params.type}'`)
    }
    if (!params.includeInternal) {
      conditions.push(`internal != true`)
    }
    return conditions.join(' AND ')
  }
  public async getSimulationJobs(params: DefaultApiGetSimulationsRequest) {
    const conditions = this.getSimulationJobsWhereConditions(params)
    const sortField = params.sortField
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number
    const { items, count } = await offsetPaginateClickhouseWithoutDataTable(
      this.clickhouseClient,
      this.simulationTaskTableName,
      {
        pageSize,
        page,
        sortField,
        sortOrder,
      },
      conditions,
      {},
      'id',
      false
    )
    return { items: items.map((item) => item.id), count }
  }
}
