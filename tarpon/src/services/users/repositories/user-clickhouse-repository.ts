import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import {
  DefaultApiGetAllUsersListV2Request,
  DefaultApiGetBusinessUsersListV2Request,
  DefaultApiGetConsumerUsersListV2Request,
} from '@/@types/openapi-internal/RequestParameters'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { DEFAULT_PAGE_SIZE, offsetPaginateClickhouse } from '@/utils/pagination'
import { getSortedData, isClickhouseEnabled } from '@/utils/clickhouse/utils'

export class UserClickhouseRepository {
  private tenantId: string
  private clickhouseClient?: ClickHouseClient
  private dynamoDb?: DynamoDBDocumentClient
  constructor(
    tenantId: string,
    clickhouseClient?: ClickHouseClient,
    dynamoDb?: DynamoDBDocumentClient
  ) {
    this.tenantId = tenantId
    this.clickhouseClient = clickhouseClient
    this.dynamoDb = dynamoDb
  }

  public async getUsersV2<T>(
    params: DefaultApiGetAllUsersListV2Request,
    columns: Record<string, string>,
    callback: (data: Record<string, string | number>) => T,
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<{
    items: T[]
    count: number
  }> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }

      return {
        items: [],
        count: 0,
      }
    }

    const whereClause = await this.buildWhereClause(params, userType)
    const sortField =
      (params.sortField === 'createdTimestamp'
        ? 'timestamp'
        : params.sortField) ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const data = await offsetPaginateClickhouse<T>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.USERS.tableName,
      { page, pageSize, sortField, sortOrder },
      whereClause,
      columns,
      callback
    )

    const sortFieldInItem =
      sortField === 'timestamp' ? 'createdTimestamp' : sortField

    const sortedUsers = getSortedData<T>({
      data: data.items.filter((item) => item[sortFieldInItem] != null),
      sortField: sortFieldInItem,
      sortOrder,
      groupByField: 'userId',
      groupBySortField: sortFieldInItem,
    })

    return {
      items: [
        ...data.items.filter((item) => item[sortFieldInItem] == null),
        ...sortedUsers,
      ],
      count: data.count,
    }
  }

  private async buildWhereClause(
    params: DefaultApiGetAllUsersListV2Request &
      DefaultApiGetConsumerUsersListV2Request &
      DefaultApiGetBusinessUsersListV2Request,
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<string> {
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const whereClauses: string[] = []
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    if (params.afterTimestamp != null && params.beforeTimestamp != null) {
      whereClauses.push(
        `timestamp > ${params.afterTimestamp} AND timestamp < ${params.beforeTimestamp}`
      )
    }
    if (params.filterId) {
      whereClauses.push(`id LIKE '${params.filterId}%'`)
    }
    if (userType) {
      whereClauses.push(`type = '${userType}'`)
    }

    if (
      params.filterIsPepHit != null ||
      params.filterPepCountry != null ||
      params.filterPepRank != null
    ) {
      // if false check for pepDetails which are empty or all have false
      if (params.filterIsPepHit === 'false') {
        whereClauses.push(
          `(arrayAll(x -> x.isPepHit = false, pepDetails) OR length(pepDetails) = 0)`
        )
      }

      if (params.filterIsPepHit === 'true') {
        const arrayExistsClauses: string[] = []

        arrayExistsClauses.push(`x.isPepHit = true`)

        if (params.filterPepCountry?.length) {
          arrayExistsClauses.push(
            `x.pepCountry IN ('${params.filterPepCountry.join("','")}')`
          )
        }

        if (params.filterPepRank != null) {
          arrayExistsClauses.push(`x.pepRank = '${params.filterPepRank}'`)
        }

        whereClauses.push(
          `arrayExists(x -> ${arrayExistsClauses.join(' AND ')}, pepDetails)`
        )
      }
    }

    if (params.filterName) {
      whereClauses.push(`username LIKE '%${params.filterName}%'`)
    }
    if (params.filterRiskLevel) {
      const riskScoreBounds = params.filterRiskLevel
        .map((riskLevel) =>
          getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel)
        )
        .map(
          (bounds) =>
            `(drsScore_drsScore >= ${bounds.lowerBoundRiskScore} AND drsScore_drsScore < ${bounds.upperBoundRiskScore})`
        )
        .join(' OR ')
      whereClauses.push(
        `(craRiskLevel IN ('${params.filterRiskLevel.join(
          "','"
        )}') OR (${riskScoreBounds}))`
      )
    }
    if (params.filterTagKey || params.filterTagValue) {
      if (!params.filterTagValue) {
        whereClauses.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}', tags)`
        )
      } else {
        whereClauses.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}' AND x.value = '${params.filterTagValue}', tags)`
        )
      }
    }
    if (params.filterRiskLevelLocked != null) {
      const isUpdatable = params.filterRiskLevelLocked === 'true' ? 'Yes' : 'No'
      whereClauses.push(`riskLevelLocked = '${isUpdatable}'`)
    }
    if (params.filterUserRegistrationStatus) {
      whereClauses.push(
        `userRegistrationStatus IN ('${params.filterUserRegistrationStatus.join(
          "','"
        )}')`
      )
    }
    return whereClauses.join(' AND ')
  }
}
