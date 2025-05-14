import { ClickHouseClient } from '@clickhouse/client'
import { intersection, isEmpty } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AlertParams } from './repository'
import { Alert } from '@/@types/openapi-internal/Alert'
import {
  DEFAULT_PAGE_SIZE,
  offsetPaginateClickhouseWithoutDataTable,
} from '@/utils/pagination'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import {
  executeClickhouseQuery,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { AccountsService } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { hasFeature } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { RuleInstanceAlertsStats } from '@/@types/openapi-internal/RuleInstanceAlertsStats'
import { traceable } from '@/core/xray'
import { getAssignmentsStatus } from '@/services/case-alerts-common/utils'
export interface AlertClickhouse extends Alert {
  caseStatus?: string
}

type StatusChanges = {
  statusChanges: CaseStatusChange[]
}

// Note: Do not export this variables as they are not used outside this file
const CASES_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.CASES_V2.tableName
const ALERTS_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.ALERTS.tableName
@traceable
export class ClickhouseAlertRepository {
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
   * Gets the alerts for investigation times for the given ruleInstanceId and time range
   * @param ruleInstanceId - The ruleInstanceId to filter alerts by
   * @param afterTimestamp - The start timestamp to filter alerts by
   * @param beforeTimestamp - The end timestamp to filter alerts by
   * @returns An array of alerts status changes
   */
  async getAlertsForInvestigationTimes(
    ruleInstanceId: string,
    afterTimestamp: number,
    beforeTimestamp: number
  ) {
    let query = ''
    if (isClickhouseMigrationEnabled()) {
      query = `
      SELECT 
        statusChanges 
      FROM ${ALERTS_TABLE_NAME_CH} 
      WHERE ruleInstanceId = '${ruleInstanceId}' 
        AND timestamp >= ${afterTimestamp} 
        AND timestamp <= ${beforeTimestamp}
    `
    } else {
      query = `
        SELECT 
          alerts.statusChanges as statusChanges 
        FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} 
        ARRAY JOIN alerts 
        WHERE alerts.ruleInstanceId = '${ruleInstanceId}' 
          AND alerts.createdTimestamp >= ${afterTimestamp} 
          AND alerts.createdTimestamp <= ${beforeTimestamp}
      `
    }

    const statusChangesData = await executeClickhouseQuery<StatusChanges[]>(
      this.clickhouseClient,
      query
    )

    return statusChangesData
  }

  /**
   * Gets the alerts matching the given filter parameters
   * @param params - Filter parameters for alerts query
   * @returns An paginated list of alerts
   */
  async getAlerts(params: AlertParams) {
    let sortField: string
    switch (params.sortField) {
      case 'alertId':
        sortField = 'alertIdNumber'
        break
      case 'createdTimestamp':
        sortField = 'timestamp'
        break
      case 'caseId':
        sortField = 'caseIdNumber'
        break
      default:
        sortField = params.sortField ?? 'timestamp'
    }
    const query = await this.getWhereConditions(params)
    const page = params.page ?? 1
    const pageSize = (params.pageSize || DEFAULT_PAGE_SIZE) as number

    const { items, count } = await offsetPaginateClickhouseWithoutDataTable(
      this.clickhouseClient,
      ALERTS_TABLE_NAME_CH,
      {
        pageSize:
          typeof params.pageSize === 'number'
            ? params.pageSize
            : DEFAULT_PAGE_SIZE,
        page: params.page ?? 1,
        sortField,
        sortOrder: params.sortOrder ?? 'ascend',
      },
      query
    )

    return {
      items,
      total: count,
      page,
      pageSize,
    }
  }

  /**
   * Gets the assignment filter for the given key
   * @param key - The key to get the assignment filter for
   * @param filterAssignmentsIds - The assigneeIds to filter alerts by
   * @returns The assignment filter for the given key
   */
  private getAssignmentFilter(
    key: 'reviewAssignments' | 'assignments',
    filterAssignmentsIds: string[]
  ): string {
    const isUnassignedIncluded = filterAssignmentsIds.includes('Unassigned')
    const assignmentsStatus = getAssignmentsStatus(key, 'alert')

    const statusCondition = `alertStatus IN ('${assignmentsStatus.join(
      "','"
    )}')`

    let assignmentCondition: string
    const assignmentArrayExtraction = `arrayMap(x -> x.assigneeUserId, ${key})`
    if (isUnassignedIncluded) {
      assignmentCondition = `
    (hasAny(${assignmentArrayExtraction}, ['${filterAssignmentsIds.join(
        "','"
      )}'])
    OR
    (${key} = [] OR ${key} IS NULL))
  `
    } else {
      assignmentCondition = `hasAny(${assignmentArrayExtraction}, ['${filterAssignmentsIds.join(
        "','"
      )}'])`
    }
    return `(${statusCondition} AND ${assignmentCondition})`
  }

  /**
   * Gets the case dependent where conditions for the alerts query
   * @param params - Filter parameters for alerts query
   * @returns The case dependent where conditions for the alerts query
   */
  private async getCaseDependentWhereConditions(
    params: AlertParams
  ): Promise<string> {
    const whereConditions: string[] = []

    if (
      params.filterCaseAfterCreatedTimestamp != null &&
      params.filterCaseBeforeCreatedTimestamp != null
    ) {
      whereConditions.push(
        `timestamp >= ${params.filterCaseAfterCreatedTimestamp} AND timestamp <= ${params.filterCaseBeforeCreatedTimestamp}`
      )
    }

    if (params.filterOriginPaymentMethods != null) {
      whereConditions.push(`
        hasAny(originPaymentMethods, ['${params.filterOriginPaymentMethods.join(
          "','"
        )}'])
      `)
    }

    if (params.filterDestinationPaymentMethods != null) {
      whereConditions.push(`
        hasAny(destinationPaymentMethods, ['${params.filterDestinationPaymentMethods.join(
          "','"
        )}'])
      `)
    }
    if (params.filterCaseTypes?.length) {
      whereConditions.push(
        `caseType IN ('${params.filterCaseTypes.join("','")}')`
      )
    }
    if (params.filterUserId != null) {
      whereConditions.push(
        `(originUserId = '${params.filterUserId}' OR destinationUserId = '${params.filterUserId}')`
      )
    }
    if (params.filterBusinessIndustries != null) {
      whereConditions.push(`
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

      whereConditions.push(`(${riskLevelConditions.join(' OR ')})`)
    }
    if (whereConditions.length) {
      return `caseId IN (SELECT id FROM ${CASES_TABLE_NAME_CH} cases WHERE ${whereConditions.join(
        ' AND '
      )})`
    }
    return ''
  }
  /**
   * Gets the where conditions for the alerts query
   * @param params - Filter parameters for alerts query
   * @returns The where conditions for the alerts query
   */
  private async getWhereConditions(params: AlertParams): Promise<string> {
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

    if (params.filterCaseId != null) {
      whereConditions.push(`caseId ILIKE '${params.filterCaseId}%'`)
    }

    if (params.excludeAlertIds != null) {
      whereConditions.push(
        `id NOT IN ('${params.excludeAlertIds.join("','")}')`
      )
    }

    if (params.filterTransactionIds != null) {
      whereConditions.push(
        `hasAny(transactionIds, ['${params.filterTransactionIds.join("','")}'])`
      )
    }

    if (params.filterAction != null) {
      whereConditions.push(`ruleAction = '${params.filterAction}'`)
    }

    if (params.filterRulesHit != null) {
      whereConditions.push(
        `ruleInstanceId IN ('${params.filterRulesHit.join("','")}')`
      )
    }

    if (params.filterAlertPriority != null) {
      whereConditions.push(
        `priority IN ('${params.filterAlertPriority.join("','")}')`
      )
    }

    if (params.filterQaStatus != null) {
      const filterQaStatus =
        params.filterQaStatus === "NOT_QA'd"
          ? `NOT IN ('PASSED', 'FAILED')`
          : `= '${params.filterQaStatus}'`

      whereConditions.push(`ruleQaStatus ${filterQaStatus}`)
    }

    if (
      params.filterAlertBeforeCreatedTimestamp != null &&
      params.filterAlertAfterCreatedTimestamp != null
    ) {
      whereConditions.push(
        `timestamp >= ${params.filterAlertAfterCreatedTimestamp} AND timestamp <= ${params.filterAlertBeforeCreatedTimestamp}`
      )
    }

    if (
      params.filterAlertsByLastUpdatedEndTimestamp != null &&
      params.filterAlertsByLastUpdatedStartTimestamp != null
    ) {
      whereConditions.push(
        `updatedAt >= ${params.filterAlertsByLastUpdatedStartTimestamp} AND updatedAt <= ${params.filterAlertsByLastUpdatedEndTimestamp}`
      )
    }

    if (params.filterClosingReason != null) {
      whereConditions.push(
        `(alertStatus = 'CLOSED' AND lastStatusChangeReasons IN ('${params.filterClosingReason.join(
          "','"
        )}'))`
      )
    }

    if (params.filterAlertId != null) {
      whereConditions.push(`id ILIKE '${params.filterAlertId}%'`)
    }

    if (params.filterQaAssignmentsIds != null) {
      whereConditions.push(
        `arrayExists(assignment -> assignment.assigneeUserId IN ('${params.filterQaAssignmentsIds.join(
          "','"
        )}'), qaAssignment)`
      )
    }

    if (params.filterAssignmentsRoles?.length) {
      const accountsService = AccountsService.getInstance(this.dynamoDb)
      const accountIdsWithRole = await accountsService.getAccountIdsForRoles(
        this.tenantId,
        params.filterAssignmentsRoles
      )
      if (params.filterAssignmentsRoles.includes('Unassigned')) {
        // Special case to handle unassigned cases
        accountIdsWithRole.push('Unassigned')
      }
      if (isEmpty(params.filterAssignmentsIds)) {
        params.filterAssignmentsIds = accountIdsWithRole
      } else {
        params.filterAssignmentsIds = intersection(
          params.filterAssignmentsIds,
          accountIdsWithRole
        )
      }

      if (isEmpty(params.filterAssignmentsIds)) {
        // If no accountIds are found for the roles or no intersection is found, search for a dummy value which does
        // not exist which mimic the behavior of not returning any cases
        params.filterAssignmentsIds = ['DUMMY']
      }
    }

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds?.length
    ) {
      whereConditions.push(
        `(${this.getAssignmentFilter(
          'reviewAssignments',
          params.filterAssignmentsIds
        )} OR ${this.getAssignmentFilter(
          'assignments',
          params.filterAssignmentsIds
        )})`
      )
    }

    if (params.filterRuleInstanceId != null) {
      whereConditions.push(
        `ruleInstanceId IN ('${params.filterRuleInstanceId.join("','")}')`
      )
    }

    if (params.filterRuleQueueIds != null) {
      const defaultCondition = params.filterRuleQueueIds.includes('default')
        ? "OR ruleQueueId = ''"
        : ''
      whereConditions.push(
        `(ruleQueueId IN ('${params.filterRuleQueueIds.join(
          "','"
        )}') ${defaultCondition})`
      )
    }

    if (params.filterRuleNature != null) {
      whereConditions.push(
        `ruleNature IN ('${params.filterRuleNature.join("','")}')`
      )
    }

    if (params.filterAlertSlaPolicyId != null) {
      whereConditions.push(
        `arrayExists(x -> x.slaPolicyId IN ('${params.filterAlertSlaPolicyId.join(
          "','"
        )}'), slaPolicyDetails)`
      )
    }

    if (params.filterAlertSlaPolicyStatus != null) {
      whereConditions.push(
        `arrayExists(x -> x.policyStatus IN ('${params.filterAlertSlaPolicyStatus.join(
          "','"
        )}'), slaPolicyDetails)`
      )
    }
    const caseDependentWhereConditions =
      await this.getCaseDependentWhereConditions(params)
    if (caseDependentWhereConditions) {
      whereConditions.push(caseDependentWhereConditions)
    }
    return whereConditions.join(' AND ')
  }

  /**
   * Validates the QA status of alerts
   * @param alertIds - The alertIds to validate
   * @returns An array of alerts
   */
  async validateAlertsQAStatus(alertIds: string[]) {
    const query = `
    SELECT
      id as alertId,
      JSONExtractArrayRaw(data, 'ruleChecklist') as ruleChecklist
    FROM ${ALERTS_TABLE_NAME_CH}
    WHERE
      alertId IN (${alertIds.map((id) => `'${id}'`).join(',')})
      AND ruleChecklistTemplateId != ''
      AND ruleQaStatus = ''
        `
    const alerts = await executeClickhouseQuery<Alert[]>(
      this.clickhouseClient,
      query
    )
    return alerts
  }

  /**
   * Gets the cases that are assigned to the given assigneeId
   * @param assigneeId - The assigneeId to filter cases by
   * @returns An array of cases
   */
  async getCasesByAssigneeId(assigneeId: string): Promise<Case[]> {
    const query = `
      SELECT id
      FROM ${CASES_TABLE_NAME_CH}
      WHERE id IN (
        SELECT caseId
        FROM ${ALERTS_TABLE_NAME_CH}
          WHERE arrayExists(x -> x.assigneeUserId = '${assigneeId}', assignments) AND alertStatus = 'CLOSED'
      )
    `
    const cases = await executeClickhouseQuery<Case[]>(
      this.clickhouseClient,
      query
    )
    return cases
  }

  /**
   * Gets the caseIds for cases that are assigned to the given assigneeId
   * @param assigneeId - The assigneeId to filter cases by
   * @returns An array of caseIds
   */
  async getCaseIdsByAssigneeId(assigneeId: string): Promise<string[]> {
    const query = `
      SELECT id
      FROM ${CASES_TABLE_NAME_CH}
      WHERE id IN (
        SELECT caseId
        FROM ${ALERTS_TABLE_NAME_CH}
          WHERE arrayExists(x -> x.assigneeUserId = '${assigneeId}', assignments) AND alertStatus NOT IN ('CLOSED', 'REJECTED', 'ARCHIVED')
      )
    `
    const cases = await executeClickhouseQuery<string[]>(
      this.clickhouseClient,
      query
    )
    return cases
  }

  /**
   * Gets the total count of alerts matching the given filter parameters
   * @param params - Filter parameters for alerts query
   * @returns Total number of matching alerts
   */
  async getAlertsCount(params: AlertParams): Promise<number> {
    const whereConditions = await this.getWhereConditions(params)
    const q = `
      SELECT count(*) 
      FROM ${ALERTS_TABLE_NAME_CH}
      WHERE ${whereConditions}
    `
    const result = await executeClickhouseQuery<[number]>(
      this.clickhouseClient,
      q
    )

    return result[0]
  }

  /**
   * Gets the rule instance stats for the given ruleInstanceId and time range
   * @param ruleInstanceId - The ruleInstanceId to filter alerts by
   * @param timeRange - The time range to filter alerts by
   * @returns An array of rule instance stats
   */
  async getRuleInstanceStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<RuleInstanceAlertsStats[]> {
    const query = `
      SELECT
        toDate(timestamp / 1000) AS date,
        COUNT(*) AS alertsCreated,
        SUM(
          IF(
            arrayExists(x -> match(x, '(?i)False\\s+positive'), lastStatusChangeReasons),
            1,
            0
          )
        ) AS falsePositiveAlerts
      FROM ${ALERTS_TABLE_NAME_CH}
      WHERE ruleInstanceId = '${ruleInstanceId}'
        AND timestamp BETWEEN ${timeRange.afterTimestamp} 
        AND ${timeRange.beforeTimestamp}
      GROUP BY date
      ORDER BY date ASC
    `

    return executeClickhouseQuery<RuleInstanceAlertsStats[]>(
      this.clickhouseClient,
      query
    )
  }
  /**
   * Get alert IDs with the specified assignee
   *
   * @param assigneeId - The ID of the assignee to find alerts for
   * @returns Promise resolving to objects containing alert IDs and whether they have multiple assignments
   */
  public async getAlertIdsForReassignment(assigneeId: string): Promise<{
    assignments: { single: string[]; multiple: string[] }
    reviewAssignments: { single: string[]; multiple: string[] }
    qaAssignment: { single: string[]; multiple: string[] }
  }> {
    // Helper function to categorize results
    const categorizeResults = (
      results: { alertId: string; hasMultipleAssignments: number }[]
    ) => ({
      single: results
        .filter((c) => c.hasMultipleAssignments === 0)
        .map((c) => c.alertId),
      multiple: results
        .filter((c) => c.hasMultipleAssignments === 1)
        .map((c) => c.alertId),
    })

    const [assignmentResults, reviewAssignmentResults, qaAssignmentResults] =
      await Promise.all([
        executeClickhouseQuery<
          { alertId: string; hasMultipleAssignments: number }[]
        >(this.clickhouseClient, {
          query: `
              SELECT 
                id as alertId,
                arrayLength(assignments) > 1 as hasMultipleAssignments
              FROM ${ALERTS_TABLE_NAME_CH} FINAL
              ARRAY JOIN assignments
              WHERE assignments.assigneeUserId = '${assigneeId}'
            `,
          format: 'JSONEachRow',
        }),
        executeClickhouseQuery<
          { alertId: string; hasMultipleAssignments: number }[]
        >(this.clickhouseClient, {
          query: `
              SELECT 
                id as alertId,
                arrayLength(reviewAssignments) > 1 as hasMultipleAssignments
              FROM ${ALERTS_TABLE_NAME_CH} FINAL
              ARRAY JOIN reviewAssignments
              WHERE reviewAssignments.assigneeUserId = '${assigneeId}'
            `,
          format: 'JSONEachRow',
        }),
        executeClickhouseQuery<
          { alertId: string; hasMultipleAssignments: number }[]
        >(this.clickhouseClient, {
          query: `
              SELECT 
                id as alertId,
                arrayLength(qaAssignment) > 1 as hasMultipleAssignments
              FROM ${ALERTS_TABLE_NAME_CH} FINAL
              ARRAY JOIN qaAssignment
              WHERE qaAssignment.assigneeUserId = '${assigneeId}'
            `,
          format: 'JSONEachRow',
        }),
      ])

    return {
      assignments: categorizeResults(assignmentResults),
      reviewAssignments: categorizeResults(reviewAssignmentResults),
      qaAssignment: categorizeResults(qaAssignmentResults),
    }
  }

  /**
   * Get alert IDs for updating rule queue
   *
   * @param ruleInstanceId - The ID of the rule instance to find alerts for
   * @returns Promise resolving to an array of alert IDs
   */
  public async getAlertIdsForUpdateRuleQueue(
    ruleInstanceId: string
  ): Promise<string[]> {
    const query = `
      SELECT id as alertId
      FROM ${ALERTS_TABLE_NAME_CH}
      WHERE ruleInstanceId = '${ruleInstanceId}'
    `
    const alerts = await executeClickhouseQuery<Alert[]>(
      this.clickhouseClient,
      query
    )
    return alerts.map((alert) => alert.alertId as string)
  }

  /**
   * Get alert IDs for deleting rule queue
   *
   * @param ruleQueueId - The ID of the rule queue to find alerts for
   * @returns Promise resolving to an array of alert IDs
   */
  public async getAlertIdsForDeleteRuleQueue(
    ruleQueueId: string
  ): Promise<string[]> {
    const query = `
      SELECT id as alertId
      FROM ${ALERTS_TABLE_NAME_CH}
      WHERE ruleQueueId = '${ruleQueueId}'
    `
    const alerts = await executeClickhouseQuery<Alert[]>(
      this.clickhouseClient,
      query
    )
    return alerts.map((alert) => alert.alertId as string)
  }
}
