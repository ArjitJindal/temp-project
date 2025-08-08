import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

import {
  COUNT_QUERY_LIMIT,
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouse,
  CursorPaginationResponse,
  cursorPaginateClickhouse,
} from '@/utils/pagination'
import {
  getSortedData,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { hasFeature } from '@/core/utils/context'
import {
  AllUsersTableItem,
  RiskClassificationScore,
  AllUsersOffsetPaginateListResponse,
  InternalUser,
  AllUsersPreviewOffsetPaginateListResponse,
  AllUsersTableItemPreview,
} from '@/@types/openapi-internal/all'
import { LinkerService } from '@/services/linker'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'

type UserCasesCount = {
  casesCount: number
  userId: string
}

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
    params: DefaultApiGetAllUsersListRequest,
    filterOperator: 'AND' | 'OR',
    includeCasesCount: boolean,
    columns: Record<string, string>,
    callback: (data: Record<string, string | number>) => T,
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<AllUsersOffsetPaginateListResponse> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return { items: [], count: 0 }
    }

    if (params.filterParentId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(params.filterParentId)
      params.filterIds = userIds
    }

    const isPulseEnabled = this.isPulseEnabled()
    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const riskClassificationValues = isPulseEnabled
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

      const casesCount = await executeClickhouseQuery<UserCasesCount[]>(
        this.tenantId,
        casesCountQuery
      )

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
    const sortFieldInItem =
      sortField === 'timestamp' ? 'createdTimestamp' : sortField

    const sortedUsers = getSortedData<T>({
      data: result.items.filter((item) => item[sortFieldInItem] != null),
      sortField: sortFieldInItem,
      sortOrder,
      groupByField: 'userId',
      groupBySortField: sortFieldInItem,
    })

    return {
      items: [
        ...result.items.filter((item) => item[sortFieldInItem] == null),
        ...sortedUsers,
      ],
      count: result.count,
    }
  }

  public async getClickhouseUsersPreviewPaginate(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersPreviewOffsetPaginateListResponse> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return { items: [], count: 0 }
    }
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    // Use the lite pagination utility
    const selectQuery = `
      select id as userId, username as name, JSONExtractString(data, 'riskLevel') as riskLevel
      from ${CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table} FINAL
      where (id = '${params.filterId}' OR ilike(username, '%${
      params.filterName
    }%'))
      limit ${pageSize + 1}
    `

    let result = await executeClickhouseQuery<
      {
        userId: string
        userName: string
        riskLevel: string
      }[]
    >(this.tenantId, selectQuery)

    const userIds = result.map((user) => user.userId)
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

    const casesCount = await executeClickhouseQuery<UserCasesCount[]>(
      this.tenantId,
      casesCountQuery
    )

    // Create a Map for O(1) lookup instead of using find() in a loop
    const casesCountMap = new Map<string, number>()
    casesCount.forEach((item) => {
      casesCountMap.set(item.userId, item.casesCount)
    })

    result = result.map((user) => ({
      ...user,
      casesCount: casesCountMap.get(user.userId) || 0,
    }))

    return {
      items: result as AllUsersTableItemPreview[],
      count: result.length,
    }
  }

  public async getUsersV2<T>(
    params: DefaultApiGetAllUsersListRequest,
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

    if (params.filterParentId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(params.filterParentId)
      params.filterIds = userIds
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

  public async usersSearchExternal(
    params: DefaultApiGetUsersSearchRequest
  ): Promise<
    CursorPaginationResponse<InternalConsumerUser | InternalBusinessUser>
  > {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return {
        items: [],
        next: '',
        prev: '',
        last: '',
        hasNext: false,
        hasPrev: false,
        count: 0,
        limit: COUNT_QUERY_LIMIT,
        pageSize: params.pageSize || 20,
      }
    }

    const whereClause = await this.buildWhereClause({
      filterName: params.name,
      filterEmail: params.email,
    })

    const sortField =
      params.sortBy === 'createdTimestamp'
        ? 'timestamp'
        : params.sortBy || 'timestamp'
    const sortOrder =
      params.sortOrder === 'asc'
        ? 'ascend'
        : params.sortOrder === 'desc'
        ? 'descend'
        : 'ascend'
    const pageSize = params.pageSize || 20

    const columns = {
      id: 'id',
      userId: 'id',
      data: 'data',
      createdTimestamp: 'timestamp',
      timestamp: 'timestamp',
      type: 'type',
      username: 'username',
    }

    const callback = (data: Record<string, string | number>) => {
      const userData = JSON.parse(data.data as string)
      return {
        ...userData,
        userId: data.userId as string,
        createdTimestamp: data.createdTimestamp as number,
        type: data.type as string,
      } as InternalConsumerUser | InternalBusinessUser
    }

    const result = await cursorPaginateClickhouse<
      InternalConsumerUser | InternalBusinessUser
    >(
      this.clickhouseClient,
      CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table,
      CLICKHOUSE_DEFINITIONS.USERS.tableName,
      whereClause,
      {
        pageSize,
        sortField,
        fromCursorKey: params.start,
        sortOrder,
      },
      columns,
      callback
    )

    return result
  }

  private async buildWhereClause(
    params: DefaultApiGetAllUsersListRequest &
      DefaultApiGetConsumerUsersListRequest &
      DefaultApiGetBusinessUsersListRequest & {
        filterEmail?: string
      },
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

    if (params.filterIds || params.filterId) {
      const allIds = [
        ...(params.filterId ? [params.filterId] : []),
        ...(params.filterIds || []),
      ]
      const escapedIds = allIds.map((id) => id.replace(/'/g, "''"))
      filterConditions.push(`id IN ('${escapedIds.join("','")}')`)
    }

    if (params.filterName) {
      filterConditions.push(
        `ilike(username, '%${params.filterName.replace(/'/g, "''")}%')`
      )
    }

    if (params.filterEmail) {
      filterConditions.push(
        `arrayExists(x -> ilike(x, '%${params.filterEmail.replace(
          /'/g,
          "''"
        )}%'), emailIds)`
      )
    }

    if ((options?.isPulseEnabled ?? true) && params.filterRiskLevel) {
      const riskLevelConditions: string[] = [
        `craRiskLevel IN ('${params.filterRiskLevel.join("','")}')`,
      ]

      const riskScoreBounds = params.filterRiskLevel
        .map((riskLevel) => ({
          ...getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel),
          riskLevel,
        }))
        .map((bounds) =>
          bounds.lowerBoundRiskScore === bounds.upperBoundRiskScore &&
          bounds.riskLevel === 'VERY_HIGH'
            ? `(drsScore_drsScore=${bounds.lowerBoundRiskScore})`
            : `(drsScore_drsScore >= ${bounds.lowerBoundRiskScore} AND drsScore_drsScore < ${bounds.upperBoundRiskScore})`
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

    if (params.filterCountryOfResidence) {
      filterConditions.push(
        `residence IN ('${params.filterCountryOfResidence.join("','")}')`
      )
    }

    if (params.filterCountryOfNationality) {
      filterConditions.push(
        `nationality IN ('${params.filterCountryOfNationality.join("','")}')`
      )
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

    if (params.filterUserState) {
      filterConditions.push(
        `userStateDetails_state IN ('${params.filterUserState.join("','")}')`
      )
    }

    if (params.filterKycStatus) {
      filterConditions.push(
        `kycStatusDetails_status IN ('${params.filterKycStatus.join("','")}')`
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

  public async getUserIdsByEmails(emails: string[]): Promise<string[]> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return []
    }
    const escapedEmails = emails.map((email) => `"${email}"`).join(',')
    const query = `
      SELECT id FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
      WHERE hasAny(emailIds, ['${escapedEmails}'])
    `

    const users = await executeClickhouseQuery<{ id: string }[]>(
      this.tenantId,
      query,
      {
        format: 'JSONEachRow',
      }
    )
    return users.map((user) => user.id)
  }

  public async getChildUserIds(parentUserId: string): Promise<string[]> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return []
    }
    const query = `
      SELECT id FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
      WHERE linkedEntities_parentUserId = '${parentUserId}'
    `
    const users = await executeClickhouseQuery<{ id: string }[]>(
      this.tenantId,
      query,
      {
        format: 'JSONEachRow',
      }
    )
    return users.map((user) => user.id)
  }

  public async getUsersByIds<
    T extends UserWithRulesResult | BusinessWithRulesResult
  >(
    userIds: string[],
    columnProjection: Record<string, string> = {},
    callbackMap?: (item: Record<string, string | number>) => InternalUser
  ): Promise<T[]> {
    if (!this.clickhouseClient) {
      if (isClickhouseEnabled()) {
        throw new Error('Clickhouse client is not initialized')
      }
      return []
    }
    const columnProjectionString =
      Object.entries(columnProjection)
        .map(([key, value]) => `${value} AS ${key}`)
        .join(', ') || 'data'
    const whereClause = `id IN (${userIds.map((id) => `'${id}'`).join(',')})`
    const query = `
      SELECT ${columnProjectionString} FROM ${
      CLICKHOUSE_DEFINITIONS.USERS.tableName
    } FINAL
      ${whereClause ? `WHERE ${whereClause}` : ''} LIMIT 1000
    `
    const items = await executeClickhouseQuery<{ data: string }[]>(
      this.tenantId,
      query,
      {
        format: 'JSONEachRow',
      }
    )
    return items.map((item) =>
      callbackMap ? callbackMap(item) : JSON.parse(item.data)
    )
  }
}
