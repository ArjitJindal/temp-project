import { ClickHouseClient } from '@clickhouse/client'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { DefaultApiGetSimulationTaskIdResultRequest } from '@/@types/openapi-internal/RequestParameters'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import {
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouseWithoutDataTable,
} from '@/utils/pagination'

@traceable
export class ClickhouseSimulationResultRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private simulationResultTableName: string
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
    this.simulationResultTableName =
      CLICKHOUSE_DEFINITIONS.SIMULATION_RESULT.tableName
  }
  private async getSimulationResultWhereConditions(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ) {
    const conditions: string[] = []
    if (params.taskId) {
      conditions.push(`taskId = '${params.taskId}'`)
    }
    if (params.filterTransactionId) {
      conditions.push(`transactionId = '${params.filterTransactionId}'`)
    }
    if (params.filterUserId) {
      conditions.push(
        `userId = '${params.filterUserId}' OR originUserId = '${params.filterUserId}' OR destinationUserId = '${params.filterUserId}'`
      )
    }
    if (params.filterOriginPaymentMethod) {
      conditions.push(
        `originPaymentMethod = '${params.filterOriginPaymentMethod}'`
      )
    }
    if (params.filterDestinationPaymentMethod) {
      conditions.push(
        `destinationPaymentMethod = '${params.filterDestinationPaymentMethod}'`
      )
    }
    if (params.filterHitStatus) {
      conditions.push(`hitStatus = '${params.filterHitStatus}'`)
    }
    if (params.filterStartTimestamp) {
      conditions.push(`timestamp >= ${params.filterStartTimestamp}`)
    }
    if (params.filterEndTimestamp) {
      conditions.push(`timestamp <= ${params.filterEndTimestamp}`)
    }
    if (params.filterRuleAction) {
      conditions.push(`action = '${params.filterRuleAction}'`)
    }
    if (params.filterId) {
      conditions.push(`caseId = '${params.filterId}'`)
    }
    if (
      params.filterCurrentKrsLevel &&
      params.filterCurrentKrsLevel.length > 0
    ) {
      conditions.push(
        `currentKrsRiskLevel IN ('${params.filterCurrentKrsLevel.join("','")}')`
      )
    }
    if (
      params.filterSimulationKrsLevel &&
      params.filterSimulationKrsLevel.length > 0
    ) {
      conditions.push(
        `simulatedKrsRiskLevel IN ('${params.filterSimulationKrsLevel.join(
          "','"
        )}')`
      )
    }
    if (params.filterType) {
      conditions.push(`type = '${params.filterType}'`)
    }
    if (
      params.filterCurrentDrsLevel &&
      params.filterCurrentDrsLevel.length > 0
    ) {
      conditions.push(
        `currentDrsRiskLevel IN ('${params.filterCurrentDrsLevel.join("','")}')`
      )
    }
    if (
      params.filterSimulationDrsLevel &&
      params.filterSimulationDrsLevel.length > 0
    ) {
      conditions.push(
        `simulatedDrsRiskLevel IN ('${params.filterSimulationDrsLevel.join(
          "','"
        )}')`
      )
    }
    return conditions.join(' AND ')
  }
  public async getSimulationCount(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ): Promise<number> {
    const conditions = await this.getSimulationResultWhereConditions(params)
    const query = `SELECT count() as count FROM ${this.simulationResultTableName} WHERE ${conditions}`
    const result = await executeClickhouseQuery<{ count: number }>(
      this.clickhouseClient,
      query
    )
    return result[0].count
  }
  public async getSimulationResults(
    params: DefaultApiGetSimulationTaskIdResultRequest
  ) {
    const conditions = await this.getSimulationResultWhereConditions(params)
    const sortField = params.sortField ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number
    const { items, count } = await offsetPaginateClickhouseWithoutDataTable(
      this.clickhouseClient,
      this.simulationResultTableName,
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
