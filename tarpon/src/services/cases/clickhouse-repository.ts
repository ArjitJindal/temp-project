import { ClickHouseClient } from '@clickhouse/client'
import isEmpty from 'lodash/isEmpty'
import intersection from 'lodash/intersection'
import isNil from 'lodash/isNil'
import omitBy from 'lodash/omitBy'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { traceable } from '@/core/xray'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { Case } from '@/@types/openapi-internal/Case'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import {
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouseWithoutDataTable,
} from '@/utils/pagination'
import { AccountsService } from '@/services/accounts'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentDetailsIdentifiers } from '@/core/dynamodb/dynamodb-keys'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { hasFeature } from '@/core/utils/context'
import {
  CaseSubject,
  getAssignmentsStatus,
} from '@/services/case-alerts-common/utils'

type CaseStatusCount = {
  caseStatus: string
  count: number
}

type CasesByAssignee = {
  assigneeUserId: string
  count: number
}

type CaseTimelineStats = {
  date: string
  casesCreated: number
  casesResolved: number
}

type SubjectCasesQueryParams = {
  directions?: ('ORIGIN' | 'DESTINATION')[]
  filterMaxTransactions?: number
  filterOutCaseStatus?: CaseStatus
  filterTransactionId?: string
  filterAvailableAfterTimestamp?: (number | undefined)[]
  filterCaseType?: CaseType
}

// Note: Do not export this variables as they are not used outside this file
const CASES_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.CASES_V2.tableName
const ALERTS_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.ALERTS.tableName
@traceable
export class CaseClickhouseRepository {
  private clickhouseClient: ClickHouseClient
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient

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
  }

  /**
   * Get cases from ClickHouse with pagination
   */
  async getCases(
    params: DefaultApiGetCaseListRequest & { page?: number; pageSize?: number }
  ) {
    const whereClause = await this.getCasesWhereConditions(params)

    let sortField: string
    switch (params.sortField) {
      case 'caseId':
        sortField = 'caseIdNumber'
        break
      case 'createdTimestamp':
        sortField = 'timestamp'
        break
      case '_userName':
        sortField = 'userName'
        break
      default:
        sortField = params.sortField ?? 'timestamp'
    }
    const sortOrder = params.sortOrder ?? 'descend'
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const { items, count } = await offsetPaginateClickhouseWithoutDataTable(
      this.clickhouseClient,
      CASES_TABLE_NAME_CH,
      {
        pageSize,
        page,
        sortField,
        sortOrder,
      },
      whereClause
    )

    return {
      items: items.map((item) => item.id),
      total: count,
      page,
      pageSize,
    }
  }

  /**
   * Build WHERE conditions for case queries
   */
  private async getCasesWhereConditions(
    params: DefaultApiGetCaseListRequest
  ): Promise<string> {
    const conditions: string[] = []

    if (params.filterCaseStatus != null && params.filterCaseStatus.length > 0) {
      conditions.push(
        `caseStatus IN ('${params.filterCaseStatus.join("','")}')`
      )
    }

    if (params.filterCaseTypes != null && params.filterCaseTypes.length > 0) {
      conditions.push(`caseType IN ('${params.filterCaseTypes.join("','")}')`)
    }

    if (params.filterPriority != null) {
      conditions.push(`priority IN ('${params.filterPriority}')`)
    }
    const nowTimestamp = Date.now()
    if (
      params.afterTimestamp != null &&
      params.afterTimestamp > 0 &&
      params.beforeTimestamp != null &&
      params.beforeTimestamp < nowTimestamp * 10
    ) {
      const timeConditions: string[] = []
      const afterDate = new Date(params.afterTimestamp)
      const beforeDate = new Date(params.beforeTimestamp)

      const afterPartition =
        afterDate.getFullYear() * 100 + (afterDate.getMonth() + 1)
      const beforePartition =
        beforeDate.getFullYear() * 100 + (beforeDate.getMonth() + 1)

      if (afterPartition === beforePartition) {
        conditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) = ${afterPartition}`
        )
      } else {
        conditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) >= ${afterPartition}`
        )
        conditions.push(
          `toYYYYMM(toDateTime(timestamp / 1000)) <= ${beforePartition}`
        )
      }

      timeConditions.push(`negativeTimestamp <= ${-1 * params.afterTimestamp}`)
      timeConditions.push(`negativeTimestamp >= ${-1 * params.beforeTimestamp}`)
      conditions.push(`(${timeConditions.join(' AND ')})`)
    } else {
      if (params.afterTimestamp != null && params.afterTimestamp > 0) {
        conditions.push(`negativeTimestamp <= ${-1 * params.afterTimestamp}`)
      }
      if (
        params.beforeTimestamp != null &&
        params.beforeTimestamp < nowTimestamp * 10
      ) {
        conditions.push(`negativeTimestamp >= ${-1 * params.beforeTimestamp}`)
      }
    }

    // Add filter for case closure reasons
    if (params.filterCaseClosureReasons?.length) {
      const reasonsArray = params.filterCaseClosureReasons.map(
        (reason) => `'${reason}'`
      )
      conditions.push(
        `hasAll(lastStatusChangeReasons, [${reasonsArray.join(', ')}])`
      )
    }

    // Add filter for cases by last updated timestamp range
    if (
      params.filterCasesByLastUpdatedStartTimestamp != null &&
      params.filterCasesByLastUpdatedEndTimestamp != null
    ) {
      conditions.push(`
            updatedAt >= ${params.filterCasesByLastUpdatedStartTimestamp} AND 
            updatedAt <= ${params.filterCasesByLastUpdatedEndTimestamp}
        `)
    }

    // Filter by case ID (regex prefix match)
    if (params.filterId != null) {
      conditions.push(`id ILIKE '${params.filterId}%'`)
    }

    // Filter by exact case ID
    if (params.filterIdExact != null) {
      conditions.push(`id = '${params.filterIdExact}'`)
    }

    // Filter out cases with specific statuses
    if (
      params.filterOutCaseStatus != null &&
      params.filterOutCaseStatus.length > 0
    ) {
      conditions.push(
        `caseStatus NOT IN ('${params.filterOutCaseStatus.join("','")}')`
      )
    }
    // Filter by user ID (either origin or destination)
    if (params.filterUserId != null || params.filterUserIds != null) {
      const userIds: string[] = []

      if (params.filterUserId != null) {
        userIds.push(params.filterUserId)
      }

      if (params.filterUserIds != null) {
        userIds.push(...params.filterUserIds)
      }

      conditions.push(`
        (originUserId IN ('${userIds.join("','")}') 
        OR 
        destinationUserId IN ('${userIds.join("','")}'))
      `)
    } else {
      // Handle separate origin and destination user ID filters
      if (params.filterOriginUserId != null) {
        conditions.push(`originUserId IN ('${params.filterOriginUserId}')`)
      }
      if (params.filterDestinationUserId != null) {
        conditions.push(
          `destinationUserId IN ('${params.filterDestinationUserId}')`
        )
      }
    }
    if (
      params.filterTransactionIds != null &&
      params.filterTransactionIds.length > 0
    ) {
      conditions.push(`
          hasAny(
            caseTransactionsIds,
            ['${params.filterTransactionIds.join("','")}']
          )
        `)
    }

    // Handle role-based assignment filtering
    if (params.filterAssignmentsRoles?.length) {
      // Fetch account IDs that have the specified roles
      const accountsService = AccountsService.getInstance(this.dynamoDb, true)
      const accountIdsWithRole = await accountsService.getAccountIdsForRoles(
        this.tenantId,
        params.filterAssignmentsRoles
      )

      // Add 'Unassigned' to the list if it's in the roles
      if (params.filterAssignmentsRoles.includes('Unassigned')) {
        accountIdsWithRole.push('Unassigned')
      }

      // Use the ids to filter assignments
      if (isEmpty(params.filterAssignmentsIds)) {
        params.filterAssignmentsIds = accountIdsWithRole
      } else {
        params.filterAssignmentsIds = intersection(
          params.filterAssignmentsIds,
          accountIdsWithRole
        )
      }

      // If no matching IDs found, use a dummy value to return no results
      if (isEmpty(params.filterAssignmentsIds)) {
        params.filterAssignmentsIds = ['DUMMY']
      }
    }

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds.length > 0
    ) {
      conditions.push(
        `(${this.getAssignmentFilter(
          'reviewAssignments',
          params.filterAssignmentsIds
        )} OR ${this.getAssignmentFilter(
          'assignments',
          params.filterAssignmentsIds
        )})`
      )
    }
    if (
      params.filterTransactionIds != null &&
      params.filterTransactionIds.length > 0
    ) {
      conditions.push(`
          hasAny(
            caseTransactionsIds,
            ['${params.filterTransactionIds.join("','")}']
          )
      `)
    }

    if (params.filterUserState != null) {
      conditions.push(`
        (originUserState IN ('${params.filterUserState.join("','")}')
        OR 
        destinationUserState IN ('${params.filterUserState.join("','")}'))
      `)
    }

    if (params.filterRiskLevel != null && hasFeature('RISK_LEVELS')) {
      const riskRepository = new RiskRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
      })

      const riskClassificationValues =
        await riskRepository.getRiskClassificationValues()

      const riskLevelConditions = params.filterRiskLevel.map((riskLevel) => {
        const { lowerBoundRiskScore, upperBoundRiskScore } =
          getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel)

        return `
          (originUserDrsScore BETWEEN ${lowerBoundRiskScore} AND ${upperBoundRiskScore}
          OR 
          destinationUserDrsScore BETWEEN ${lowerBoundRiskScore} AND ${upperBoundRiskScore})
        `
      })

      conditions.push(`(${riskLevelConditions.join(' OR ')})`)
    }

    if (params.filterOriginPaymentMethods != null) {
      conditions.push(`
        hasAny(
          originPaymentMethods,
          ['${params.filterOriginPaymentMethods.join("','")}']
        )
      `)
    }

    if (params.filterDestinationPaymentMethods != null) {
      conditions.push(`
        hasAny(
          destinationPaymentMethods,
          ['${params.filterDestinationPaymentMethods.join("','")}']
        )
      `)
    }

    if (params.filterTransactionTagKey || params.filterTransactionTagValue) {
      const tagConditions: string[] = []

      if (params.filterTransactionTagKey) {
        tagConditions.push(`x.key = '${params.filterTransactionTagKey}'`)
      }

      if (params.filterTransactionTagValue) {
        tagConditions.push(`x.value = '${params.filterTransactionTagValue}'`)
      }

      conditions.push(`
        arrayExists(
          x -> ${tagConditions.join(' AND ')},
          tags
        )
      `)
    }

    if (params.filterBusinessIndustries != null) {
      conditions.push(`
        (
          hasAny(originBusinessIndustry, ['${params.filterBusinessIndustries.join(
            "','"
          )}'])
          OR
          hasAny(destinationBusinessIndustry, ['${params.filterBusinessIndustries.join(
            "','"
          )}'])
        )
      `)
    }
    conditions.push(`availableAfterTimestamp < ${Date.now()}`)

    const caseIdsFromAlerts = this.getCaseIdsFromAlerts(params)
    if (caseIdsFromAlerts) {
      conditions.push(caseIdsFromAlerts)
    }
    return conditions.length > 0 ? conditions.join(' AND ') : '1=1'
  }
  private getAssignmentFilter = (
    key: 'reviewAssignments' | 'assignments',
    filterAssignmentsIds: string[]
  ): string => {
    const isUnassignedIncluded = filterAssignmentsIds.includes('Unassigned')
    const assignmentsStatus = getAssignmentsStatus(key, 'case')

    const statusCondition = `caseStatus IN ('${assignmentsStatus.join("','")}')`

    let assignmentCondition: string
    const assignmentArrayExtraction = `arrayMap(x -> x.assigneeUserId, ${key})`

    if (isUnassignedIncluded) {
      assignmentCondition = `
    (hasAny(${assignmentArrayExtraction}, ['${filterAssignmentsIds.join(
        "','"
      )}'])
    OR
    (${key} = [] OR empty(${key})))
  `
    } else {
      assignmentCondition = `hasAny(${assignmentArrayExtraction}, ['${filterAssignmentsIds.join(
        "','"
      )}'])`
    }

    return `(${statusCondition} AND ${assignmentCondition})`
  }

  private getCaseIdsFromAlerts(params: DefaultApiGetCaseListRequest): string {
    const conditions: string[] = []
    if (params.filterRuleQueueIds != null) {
      const defaultCondition = params.filterRuleQueueIds.includes('default')
        ? "OR ruleQueueId = ''"
        : ''
      conditions.push(
        `ruleQueueId IN ('${params.filterRuleQueueIds.join(
          "','"
        )}') ${defaultCondition}`
      )
    }
    if (params.filterRulesHit != null) {
      conditions.push(
        `ruleInstanceId IN ('${params.filterRulesHit.join("','")}')`
      )
    }
    if (params.filterAlertPriority != null) {
      conditions.push(
        `priority IN ('${params.filterAlertPriority.join("','")}')`
      )
    }

    if (params.filterRuleNature?.length) {
      conditions.push(
        `ruleNature IN ('${params.filterRuleNature.join("','")}')`
      )
    }
    if (params.filterCaseSlaPolicyId?.length) {
      conditions.push(
        `arrayExists(x -> x.slaPolicyId IN ('${params.filterCaseSlaPolicyId.join(
          "','"
        )}'), slaPolicyDetails)`
      )
    }

    if (params.filterCaseSlaPolicyStatus?.length) {
      conditions.push(
        `arrayExists(x -> x.policyStatus IN ('${params.filterCaseSlaPolicyStatus.join(
          "','"
        )}'), slaPolicyDetails)`
      )
    }
    if (conditions.length) {
      const query = `
        id IN (SELECT caseId
        FROM ${ALERTS_TABLE_NAME_CH} FINAL
        WHERE (${conditions.join(' AND ')}))
      `
      return query
    }
    return ''
  }

  /**
   * Get case status counts
   */
  async getCaseStatusCounts(): Promise<CaseStatusCount[]> {
    const query = `
      SELECT 
        caseStatus,
        count() as count
      FROM ${CASES_TABLE_NAME_CH} FINAL
      GROUP BY caseStatus
      ORDER BY count DESC
    `

    return await executeClickhouseQuery<CaseStatusCount[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )
  }

  /**
   * Get cases by assignee --done
   */
  async getCasesByAssignee(): Promise<CasesByAssignee[]> {
    const query = `
      SELECT
        assigneeUserId,
        count() as count
      FROM ${CASES_TABLE_NAME_CH} FINAL
      ARRAY JOIN assignments AS assignment
      WHERE caseStatus NOT IN ('CLOSED', 'REJECTED', 'ARCHIVED')
      GROUP BY assignment.1 as assigneeUserId
      ORDER BY count DESC
    `

    return await executeClickhouseQuery<CasesByAssignee[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )
  }

  /**
   * Get case timeline statistics
   */
  async getCaseTimelineStats(timeRange: {
    afterTimestamp: number
    beforeTimestamp: number
  }): Promise<CaseTimelineStats[]> {
    const query = `
      SELECT
        toString(toDate(timestamp/1000)) as date,
        count() as casesCreated,
        countIf(caseStatus IN ('CLOSED', 'REJECTED', 'ARCHIVED')) as casesResolved
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
      GROUP BY date
      ORDER BY date
    `

    return await executeClickhouseQuery<CaseTimelineStats[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )
  }

  /**
   * Get case by ID
   */
  async getCaseById(caseId: string): Promise<Case | null> {
    const query = `
      SELECT data
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE id = '${caseId}'
      LIMIT 1
    `

    const results = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )

    if (results.length === 0) {
      return null
    }

    return JSON.parse(results[0].data) as Case
  }

  /**
   * Get user IDs associated with cases that were closed as false positives for a specific rule instance
   * ClickHouse implementation using the materialized alertsRuleInstanceIds field
   *
   * @param ruleInstanceId - The rule instance ID to get false positive user IDs for
   * @returns Array of user IDs that were marked as false positives for this rule
   */
  public async getFalsePositiveUserIdsByRuleInstance(
    ruleInstanceId: string
  ): Promise<string[]> {
    const query = `
      SELECT DISTINCT
        IF(originUserId != '', originUserId, destinationUserId) AS userId
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE 
        arrayExists(x -> match(x, '(?i)False\\s+positive'), lastStatusChangeReasons)
        AND caseStatus = 'CLOSED'
        AND id IN (
          SELECT caseId 
          FROM ${ALERTS_TABLE_NAME_CH} 
          WHERE ruleInstanceId = '${ruleInstanceId}'
        )
    `

    const result = await executeClickhouseQuery<{ userId: string }[]>(
      this.clickhouseClient,
      query
    )

    return result.map((row) => row.userId)
  }

  async getCasesByAlertId(alertId: string): Promise<Case[]> {
    const query = `
      SELECT data
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE id = (
        SELECT caseId
        FROM ${ALERTS_TABLE_NAME_CH} FINAL
        WHERE id = '${alertId}' LIMIT 1
      )
    `

    const results = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )
    return results.map((result) => JSON.parse(result.data) as Case)
  }

  /**
   * Get cases by transaction IDs
   */
  async getCasesByTransactionIds(transactionIds: string[]): Promise<Case[]> {
    if (!transactionIds.length) {
      return []
    }

    const query = `
      SELECT data
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE hasAny(
        caseTransactionsIds,
        ['${transactionIds.join("','")}']
      )
    `

    const results = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )

    return results.map((result) => JSON.parse(result.data) as Case)
  }

  /**
   * Get cases by subject (user ID or payment details)
   *
   * @param subject - Either a user ID or payment details to filter cases by
   * @param params - Query parameters for filtering cases
   * @returns Promise resolving to an array of cases
   */
  async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ): Promise<Case[]> {
    const conditions: string[] = []

    // Add subject-specific conditions
    if (subject.type === 'USER') {
      const userConditions = this.buildUserDirectionConditions(
        subject.user.userId,
        params.directions
      )
      conditions.push(...userConditions)
    } else {
      const paymentDetailsConditions =
        this.buildPaymentDetailsDirectionConditions(
          subject.paymentDetails,
          params.directions
        )
      conditions.push(...paymentDetailsConditions)
    }

    // Filter by availableAfterTimestamp
    if (params.filterAvailableAfterTimestamp?.length) {
      conditions.push(
        `availableAfterTimestamp IN (${params.filterAvailableAfterTimestamp.join(
          "','"
        )})`
      )
    }

    // Filter out case status
    if (params.filterOutCaseStatus) {
      conditions.push(`caseStatus != '${params.filterOutCaseStatus}'`)
    }

    // Filter by case type
    if (params.filterCaseType) {
      conditions.push(`caseType = '${params.filterCaseType}'`)
    }

    // Filter by maximum number of transactions
    if (params.filterMaxTransactions) {
      conditions.push(
        `length(caseTransactionsIds) < ${params.filterMaxTransactions}`
      )
    }

    // Filter by transaction ID
    if (params.filterTransactionId) {
      conditions.push(
        `hasAny(caseTransactionsIds, ['${params.filterTransactionId}'])`
      )
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

    const query = `
      SELECT id
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE ${whereClause}
    `

    const results = await executeClickhouseQuery<{ data: string }[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )

    return results.map((result) => JSON.parse(result.data) as Case)
  }

  /**
   * Build direction conditions for user-based case queries
   *
   * @param userId - ID of the user to filter cases by
   * @param directions - Optional array of directions to filter by (ORIGIN, DESTINATION)
   * @returns Array of SQL condition strings
   */
  private buildUserDirectionConditions(
    userId: string,
    directions?: ('ORIGIN' | 'DESTINATION')[]
  ): string[] {
    const directionConditions: string[] = []

    if (directions == null || directions.includes('ORIGIN')) {
      directionConditions.push(`originUserId = '${userId}'`)
    }

    if (directions == null || directions.includes('DESTINATION')) {
      directionConditions.push(`destinationUserId = '${userId}'`)
    }

    return directionConditions.length > 0
      ? [`(${directionConditions.join(' OR ')})`]
      : []
  }

  /**
   * Build direction conditions for payment details-based case queries
   *
   * @param paymentDetails - Payment details to filter cases by
   * @param directions - Optional array of directions to filter by (ORIGIN, DESTINATION)
   * @returns Array of SQL condition strings
   */
  private buildPaymentDetailsDirectionConditions(
    paymentDetails: PaymentDetails,
    directions?: ('ORIGIN' | 'DESTINATION')[]
  ): string[] {
    const paymentDetailsFilters = omitBy(
      {
        method: paymentDetails.method,
        ...getPaymentDetailsIdentifiers(paymentDetails),
      },
      isNil
    )

    if (Object.keys(paymentDetailsFilters).length === 0) {
      return []
    }

    const directionConditions: string[] = []

    for (const direction of directions ?? ['ORIGIN', 'DESTINATION']) {
      const directionKey = direction.toLowerCase()
      const directionFilters: string[] = []

      for (const [key, value] of Object.entries(paymentDetailsFilters)) {
        if (value !== undefined && value !== null) {
          directionFilters.push(
            `${directionKey}PaymentDetails_${key} = '${value}'`
          )
        }
      }

      if (directionFilters.length > 0) {
        directionConditions.push(`(${directionFilters.join(' AND ')})`)
      }
    }

    return directionConditions.length > 0
      ? [`(${directionConditions.join(' OR ')})`]
      : []
  }

  /**
   * Get SLA policy statistics
   */
  async getSLAPolicyStats(timeRange: {
    afterTimestamp: number
    beforeTimestamp: number
  }) {
    const query = `
      SELECT
          slaPolicy.1 AS slaPolicyId,
          slaPolicy.2 AS policyStatus,
          count(*) AS count,
          avg(slaPolicy.3) AS avgElapsedTime
      FROM ${ALERTS_TABLE_NAME_CH} FINAL
      ARRAY JOIN slaPolicyDetails AS slaPolicy
      WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
      GROUP BY slaPolicy.1, slaPolicy.2
      ORDER BY slaPolicy.1, slaPolicy.2
    `

    return await executeClickhouseQuery(this.clickhouseClient, {
      query,
      format: 'JSONEachRow',
    })
  }

  /**
   * Get the count of unique users affected by a specific rule instance
   *
   * @param ruleInstanceId - The rule instance ID to count users for
   * @returns Total number of distinct users affected by the rule
   */
  public async getAllUsersCountByRuleInstance(
    ruleInstanceId: string
  ): Promise<number> {
    const query = `
      SELECT 
        count(DISTINCT IF(originUserId != '', originUserId, destinationUserId)) AS userCount
      FROM ${CASES_TABLE_NAME_CH} FINAL
      WHERE
        id IN (
          SELECT caseId
          FROM ${ALERTS_TABLE_NAME_CH}
          WHERE ruleInstanceId = '${ruleInstanceId}'
        )
    `

    const result = await executeClickhouseQuery<{ userCount: number }[]>(
      this.clickhouseClient,
      query
    )

    return result[0]?.userCount || 0
  }

  /**
   * Get case IDs assigned to a specific user
   * This fetches case IDs by assignee ID, excluding cases with end-game statuses
   *
   * @param assigneeId - The ID of the assignee to get case IDs for
   * @returns Promise resolving to an array of case IDs
   */
  public async getCaseIdsByAssigneeId(assigneeId: string): Promise<string[]> {
    const query = `
      SELECT id AS caseId
      FROM ${CASES_TABLE_NAME_CH} FINAL
      ARRAY JOIN assignments
      WHERE 
        assignments.assigneeUserId = '${assigneeId}'
        AND caseStatus NOT IN ('CLOSED', 'REJECTED', 'ARCHIVED')
    `

    const results = await executeClickhouseQuery<{ caseId: string }[]>(
      this.clickhouseClient,
      {
        query,
        format: 'JSONEachRow',
      }
    )

    return results.map((result) => result.caseId)
  }

  /**
   * Get case IDs with the specified assignee
   *
   * @param assigneeId - The ID of the assignee to find cases for
   * @returns Promise resolving to objects containing case IDs and whether they have multiple assignments
   */
  public async getCaseIdsForReassignment(assigneeId: string): Promise<{
    assignments: { single: string[]; multiple: string[] }
    reviewAssignments: { single: string[]; multiple: string[] }
  }> {
    const assignmentsQuery = `
      SELECT 
        id AS caseId,
        count(*) > 1 AS hasMultipleAssignments
      FROM ${CASES_TABLE_NAME_CH} FINAL
      ARRAY JOIN assignments
      WHERE assignments.assigneeUserId = '${assigneeId}'
      GROUP BY id
    `

    const reviewAssignmentsQuery = `
      SELECT 
        id AS caseId,
        count(*) > 1 AS hasMultipleAssignments
      FROM ${CASES_TABLE_NAME_CH} FINAL
      ARRAY JOIN reviewAssignments
      WHERE reviewAssignments.assigneeUserId = '${assigneeId}'
      GROUP BY id
    `

    const [assignmentResults, reviewAssignmentResults] = await Promise.all([
      executeClickhouseQuery<
        { caseId: string; hasMultipleAssignments: number }[]
      >(this.clickhouseClient, {
        query: assignmentsQuery,
        format: 'JSONEachRow',
      }),
      executeClickhouseQuery<
        { caseId: string; hasMultipleAssignments: number }[]
      >(this.clickhouseClient, {
        query: reviewAssignmentsQuery,
        format: 'JSONEachRow',
      }),
    ])

    return {
      assignments: {
        single: assignmentResults
          .filter((c) => c.hasMultipleAssignments === 0)
          .map((c) => c.caseId),
        multiple: assignmentResults
          .filter((c) => c.hasMultipleAssignments === 1)
          .map((c) => c.caseId),
      },
      reviewAssignments: {
        single: reviewAssignmentResults
          .filter((c) => c.hasMultipleAssignments === 0)
          .map((c) => c.caseId),
        multiple: reviewAssignmentResults
          .filter((c) => c.hasMultipleAssignments === 1)
          .map((c) => c.caseId),
      },
    }
  }
}
