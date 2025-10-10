import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

export const getLatestTeamStatsClickhouseQuery = (
  scope: 'CASES' | 'ALERTS',
  assignmentStatuses: string[],
  reviewAssignmentStatuses: string[],
  accountIds?: string[]
) => {
  if (scope === 'CASES') {
    const assignmentFilters = [
      `caseStatus IN (${assignmentStatuses
        .map((status) => `'${status}'`)
        .join(',')})`,
      'assignments.assigneeUserId IS NOT NULL',
    ]

    const reviewFilters = [
      `caseStatus IN (${reviewAssignmentStatuses
        .map((status) => `'${status}'`)
        .join(',')})`,
      'reviewAssignments.assigneeUserId IS NOT NULL',
    ]

    if (accountIds && accountIds.length > 0) {
      assignmentFilters.push(
        `assignments.assigneeUserId IN (${accountIds
          .map((id) => `'${id}'`)
          .join(',')})`
      )
      reviewFilters.push(
        `reviewAssignments.assigneeUserId IN (${accountIds
          .map((id) => `'${id}'`)
          .join(',')})`
      )
    }
    return `
            WITH 
                assignments_stats AS (
                    SELECT 
                        assignments.assigneeUserId AS accountId,
                        countIf(caseStatus IN ('OPEN', 'REOPENED')) AS open,
                        countIf(caseStatus = 'OPEN_IN_PROGRESS') AS inProgress,
                        countIf(caseStatus = 'OPEN_ON_HOLD') AS onHold
                    FROM 
                        cases
                    ARRAY JOIN 
                        assignments
                    WHERE 
                        ${assignmentFilters.join(' AND ')}
                    GROUP BY 
                        accountId
                ),
                review_stats AS (
                    SELECT 
                        reviewAssignments.assigneeUserId AS accountId,
                        countIf(caseStatus = 'ESCALATED') AS escalated,
                        countIf(caseStatus = 'ESCALATED_IN_PROGRESS') AS reviewInProgress,
                        countIf(caseStatus = 'ESCALATED_ON_HOLD') AS reviewOnHold,
                        countIf(caseStatus IN (
                            'IN_REVIEW_OPEN',
                            'IN_REVIEW_CLOSED',
                            'IN_REVIEW_REOPENED',
                            'IN_REVIEW_ESCALATED'
                        )) AS inReview
                    FROM 
                        cases
                    ARRAY JOIN 
                        reviewAssignments
                    WHERE 
                        ${reviewFilters.join(' AND ')}
                    GROUP BY 
                        accountId
                )
            SELECT 
                COALESCE(NULLIF(a.accountId, ''), NULLIF(r.accountId, '')) as accountId,
                a.open,
                a.inProgress,
                a.onHold,
                r.escalated,
                r.reviewInProgress,
                r.reviewOnHold,
                r.inReview
            FROM 
                assignments_stats AS a
                FULL OUTER JOIN review_stats AS r
                ON a.accountId = r.accountId
        `
  } else if (scope === 'ALERTS') {
    const assignmentFilters = [
      `alerts.alertStatus IN (${assignmentStatuses
        .map((status) => `'${status}'`)
        .join(',')})`,
      'assignments.assigneeUserId IS NOT NULL',
    ]

    const reviewFilters = [
      `alerts.alertStatus IN (${reviewAssignmentStatuses
        .map((status) => `'${status}'`)
        .join(',')})`,
      'reviewAssignments.assigneeUserId IS NOT NULL',
    ]

    if (accountIds && accountIds.length > 0) {
      assignmentFilters.push(
        `assignments.assigneeUserId IN (${accountIds
          .map((id) => `'${id}'`)
          .join(',')})`
      )
      reviewFilters.push(
        `reviewAssignments.assigneeUserId IN (${accountIds
          .map((id) => `'${id}'`)
          .join(',')})`
      )
    }

    return `
            WITH 
                assignments_stats AS (
                    SELECT 
                        assignments.assigneeUserId AS accountId,
                        countIf(alerts.alertStatus IN ('OPEN', 'REOPENED')) AS open,
                        countIf(alerts.alertStatus = 'OPEN_IN_PROGRESS') AS inProgress,
                        countIf(alerts.alertStatus = 'OPEN_ON_HOLD') AS onHold
                    FROM 
                        ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
                    ARRAY JOIN 
                        alerts AS alerts
                    ARRAY JOIN alerts.assignments as assignments
                    WHERE 
                        ${assignmentFilters.join(' AND ')}
                    GROUP BY 
                        accountId
                ),
                review_stats AS (
                    SELECT 
                        reviewAssignments.assigneeUserId AS accountId,
                        countIf(alerts.alertStatus = 'ESCALATED') AS escalated,
                        countIf(alerts.alertStatus = 'ESCALATED_IN_PROGRESS') AS reviewInProgress,
                        countIf(alerts.alertStatus = 'ESCALATED_ON_HOLD') AS reviewOnHold,
                        countIf(alerts.alertStatus IN (
                            'IN_REVIEW_OPEN',
                            'IN_REVIEW_CLOSED',
                            'IN_REVIEW_REOPENED',
                            'IN_REVIEW_ESCALATED'
                        )) AS inReview
                    FROM 
                        ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
                    ARRAY JOIN 
                        alerts AS alerts
                    ARRAY JOIN alerts.reviewAssignments as reviewAssignments
                    WHERE 
                        ${reviewFilters.join(' AND ')}
                    GROUP BY 
                        accountId
                )
            SELECT 
                COALESCE(NULLIF(a.accountId, ''), NULLIF(r.accountId, '')) as accountId,
                a.open,
                a.inProgress,
                a.onHold,
                r.escalated,
                r.reviewInProgress,
                r.reviewOnHold,
                r.inReview
            FROM 
                assignments_stats AS a
                FULL OUTER JOIN review_stats AS r
                ON a.accountId = r.accountId
        `
  }
}
