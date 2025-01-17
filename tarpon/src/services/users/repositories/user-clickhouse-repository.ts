import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { insertRiskScores } from '../utils/user-utils'
import {
  DefaultApiGetAllUsersListV2Request,
  DefaultApiGetBusinessUsersListV2Request,
  DefaultApiGetConsumerUsersListV2Request,
} from '@/@types/openapi-internal/RequestParameters'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

import {
  COUNT_QUERY_LIMIT,
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouse,
} from '@/utils/pagination'
import {
  executeClickhouseQuery,
  getSortedData,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { hasFeature } from '@/core/utils/context'
import {
  AllUsersListResponse,
  AllUsersTableItem,
  RiskClassificationScore,
} from '@/@types/openapi-internal/all'

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

  private isPulseEnabled() {
    return hasFeature('RISK_LEVELS') || hasFeature('RISK_SCORING')
  }

  public async getClickhouseUsersPaginate<T extends AllUsersTableItem>(
    params: DefaultApiGetAllUsersListV2Request,
    filterOperator: 'AND' | 'OR',
    includeCasesCount: boolean,
    columns: Record<string, string>,
    callback: (data: Record<string, string | number>) => T,
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<AllUsersListResponse> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return {
        hasPrev: false,
        prev: '',
        next: '',
        count: 0,
        limit: 0,
        last: '',
        hasNext: false,
        items: [],
      }
    }

    const isPulseEnabled = this.isPulseEnabled()
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const riskClassificationValues = this.isPulseEnabled()
      ? await riskRepository.getRiskClassificationValues()
      : []
    const whereClause = await this.buildWhereClause(params, userType, {
      isPulseEnabled,
      riskClassificationValues,
      filterOperator,
    })
    const sortField =
      (params.sortField === 'createdTimestamp'
        ? 'timestamp'
        : params.sortField) ?? 'timestamp'
    const sortOrder = params.sortOrder ?? 'ascend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    // Get users data
    let result = await offsetPaginateClickhouse<T>(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.USERS.tableName,
      { page, pageSize, sortField, sortOrder },
      whereClause,
      columns,
      callback
    )

    if (includeCasesCount) {
      const userIds = result.items.map((user) => user['userId'])
      const casesCountQuery = `
        SELECT 
          userId,
          count() as casesCount
        FROM (
          SELECT originUserId as userId FROM ${
            CLICKHOUSE_DEFINITIONS.CASES.tableName
          } FINAL
          WHERE caseStatus != 'CLOSED' AND originUserId IN ('${userIds.join(
            "','"
          )}')
          UNION ALL
          SELECT destinationUserId as userId FROM ${
            CLICKHOUSE_DEFINITIONS.CASES.tableName
          } FINAL
          WHERE caseStatus != 'CLOSED' AND destinationUserId IN ('${userIds.join(
            "','"
          )}')
        )
        GROUP BY userId
        LIMIT ${COUNT_QUERY_LIMIT}
      `

      const casesCount = await executeClickhouseQuery<{
        userId: string
        casesCount: number
      }>(this.tenantId, casesCountQuery, {})

      result = {
        ...result,
        items: result.items.map((user) => ({
          ...user,
          casesCount:
            casesCount.find((item) => item.userId === user.userId)
              ?.casesCount || 0,
        })),
      }
    }
    if (isPulseEnabled) {
      result.items = insertRiskScores(result.items, riskClassificationValues)
    }

    return {
      items: result.items as AllUsersTableItem[],
      count: result.count,
      hasPrev: page > 1,
      hasNext: result.count > page * pageSize,
      prev: page > 1 ? (page - 1).toString() : '',
      next: result.count > page * pageSize ? (page + 1).toString() : '',
      last: Math.ceil(result.count / pageSize).toString(),
      limit: pageSize,
    }
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
    userType?: 'BUSINESS' | 'CONSUMER',
    options?: {
      isPulseEnabled?: boolean
      riskClassificationValues?: RiskClassificationScore[]
      filterOperator?: 'AND' | 'OR'
    }
  ): Promise<string> {
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const whereClauses: string[] = []
    const filterConditions: string[] = []
    const riskClassificationValues =
      options?.riskClassificationValues ??
      (await riskRepository.getRiskClassificationValues())
    whereClauses.push(
      `timestamp >= ${params.afterTimestamp || 0}`,
      `timestamp <= ${params.beforeTimestamp || Number.MAX_SAFE_INTEGER}`
    )

    if (userType) {
      whereClauses.push(`type = '${userType}'`)
    }

    // Filter conditions (can be OR-ed or AND-ed)
    if (params.filterId) {
      filterConditions.push(`ilike(id, '${params.filterId}%')`)
    }

    if (params.filterName) {
      filterConditions.push(`ilike(username, '%${params.filterName}%')`)
    }

    if ((options?.isPulseEnabled ?? true) && params.filterRiskLevel) {
      const riskLevelConditions: string[] = [
        `craRiskLevel IN ('${params.filterRiskLevel.join("','")}')`,
      ]

      const riskScoreBounds = params.filterRiskLevel
        .map((riskLevel) =>
          getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel)
        )
        .map(
          (bounds) =>
            `(drsScore_drsScore >= ${bounds.lowerBoundRiskScore} AND drsScore_drsScore < ${bounds.upperBoundRiskScore})`
        )
        .join(' OR ')

      riskLevelConditions.push(`(${riskScoreBounds})`)
      whereClauses.push(`(${riskLevelConditions.join(' OR ')})`)
    }

    if (
      params.filterIsPepHit != null ||
      params.filterPepCountry != null ||
      params.filterPepRank != null
    ) {
      if (params.filterIsPepHit === 'false') {
        filterConditions.push(
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

        filterConditions.push(
          `arrayExists(x -> ${arrayExistsClauses.join(' AND ')}, pepDetails)`
        )
      }
    }

    if (params.filterTagKey || params.filterTagValue) {
      if (!params.filterTagValue) {
        filterConditions.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}', tags)`
        )
      } else {
        filterConditions.push(
          `arrayExists(x -> x.key = '${params.filterTagKey}' AND x.value = '${params.filterTagValue}', tags)`
        )
      }
    }

    if (params.filterRiskLevelLocked != null) {
      const isUpdatable = params.filterRiskLevelLocked === 'true' ? 'Yes' : 'No'
      filterConditions.push(`riskLevelLocked = '${isUpdatable}'`)
    }

    if (params.filterUserRegistrationStatus) {
      filterConditions.push(
        `userRegistrationStatus IN ('${params.filterUserRegistrationStatus.join(
          "','"
        )}')`
      )
    }

    // Combine all conditions
    if (filterConditions.length > 0) {
      whereClauses.push(
        `(${filterConditions.join(
          options?.filterOperator === 'OR' ? ' OR ' : ' AND '
        )})`
      )
    }

    return whereClauses.join(' AND ')
  }
}
