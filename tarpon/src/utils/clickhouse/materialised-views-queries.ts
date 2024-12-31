import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

export const getInvestigationTimes = (
  scope: 'CASES' | 'ALERTS',
  startTimestamp?: number,
  endTimestamp?: number
) => {
  const timeConditions: string[] = []
  if (startTimestamp) {
    timeConditions.push(`end_ts >= ${startTimestamp}`)
  }
  if (endTimestamp) {
    timeConditions.push(`end_ts <= ${endTimestamp}`)
  }
  if (scope === 'CASES') {
    return `
      investigation_times AS (  
        SELECT
            assignment.assigneeUserId as accountId,
            formatDateTime(toDateTime(end_ts/1000), '%Y-%m-%d %H:00:00') as date,
            sum(toUInt64(end_ts - start_ts)) AS investigationTime,
            groupUniqArray(caseId) AS caseId,
            multiIf(
              caseStatus IN ('OPEN_IN_PROGRESS', 'OPEN_ON_HOLD'), 'OPEN',
              caseStatus IN ('ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD'), 'ESCALATED',
              caseStatus
            ) as status
          FROM (
            SELECT
              caseId,
              caseStatus,
              statusChanges[idx].timestamp as start_ts,
              statusChanges[idx + 1].timestamp as end_ts,
              if(statusChanges[idx].caseStatus = 'ESCALATED_IN_PROGRESS',
                  reviewAssignments,
                  assignments) as relevant_assignments
            FROM cases
            ARRAY JOIN arrayEnumerate(statusChanges) as idx
            WHERE length(statusChanges) > 1
              AND idx < length(statusChanges)
              AND statusChanges[idx].caseStatus IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
          )
          ARRAY JOIN relevant_assignments AS assignment
          WHERE assignment.assigneeUserId != ''
          ${
            timeConditions.length > 0
              ? `AND ${timeConditions.join(' AND ')}`
              : ''
          }
          GROUP BY
            accountId,
            date,
            status
      )
    `
  }
  return `
   investigation_times AS (
      SELECT
        assignment.assigneeUserId as accountId,
        formatDateTime(toDateTime(end_ts/1000), '%Y-%m-%d %H:00:00') as date,
        sum(toUInt64(end_ts - start_ts)) AS investigationTime,
        groupUniqArray(caseId) AS caseId,
        multiIf(
          caseStatus IN ('OPEN_IN_PROGRESS', 'OPEN_ON_HOLD'), 'OPEN',
          caseStatus IN ('ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD'), 'ESCALATED',
          caseStatus
        ) as status
      FROM (
        SELECT
          alert.alertId as caseId,
          alert.alertStatus as caseStatus,
          alert.statusChanges[idx].timestamp as start_ts,
          alert.statusChanges[idx + 1].timestamp as end_ts,
          if(alert.statusChanges[idx].caseStatus = 'ESCALATED_IN_PROGRESS',
              alert.reviewAssignments,
              alert.assignments) as relevant_assignments
        FROM cases
        ARRAY join alerts as alert
        ARRAY JOIN arrayEnumerate(alert.statusChanges) as idx
        WHERE length(alert.statusChanges) > 1
          AND idx < length(alert.statusChanges)
          AND alert.statusChanges[idx].caseStatus IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
      )
      ARRAY JOIN relevant_assignments AS assignment
      WHERE assignment.assigneeUserId != ''
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
      GROUP BY
        accountId,
        date,
        status
    )
  `
}

export const getStatusStats = (
  scope: 'CASES' | 'ALERTS',
  startTimestamp?: number,
  endTimestamp?: number
) => {
  const timeConditions: string[] = []
  if (startTimestamp) {
    timeConditions.push(`statusChange.timestamp >= ${startTimestamp}`)
  }
  if (endTimestamp) {
    timeConditions.push(`statusChange.timestamp <= ${endTimestamp}`)
  }
  if (scope === 'CASES') {
    return `
    status_stats AS (
    SELECT
      statusChange.userId as accountId,
      formatDateTime(toDateTime(statusChange.timestamp / 1000), '%Y-%m-%d %H:00:00') as date,
      caseStatus as status,
      count(*) FILTER(WHERE statusChange.caseStatus = 'CLOSED') as closedBy,
      count(*) FILTER(WHERE statusChange.caseStatus = 'ESCALATED') as escalatedBy,
      count(*) FILTER(WHERE statusChange.caseStatus IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')) as inProgress
    FROM cases
    ARRAY JOIN statusChanges AS statusChange
    WHERE statusChange.userId != ''
      AND statusChange.caseStatus IN ('CLOSED', 'ESCALATED', 'OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
      GROUP BY accountId, date, status  
    )
    `
  }
  return `
  status_stats AS (
    SELECT
      statusChange.userId as accountId,
      formatDateTime(toDateTime(statusChange.timestamp/1000), '%Y-%m-%d %H:00:00') as date,
      alert.alertStatus as status,
      count(*) FILTER(WHERE statusChange.caseStatus = 'CLOSED') as closedBy,
      count(*) FILTER(WHERE statusChange.caseStatus = 'ESCALATED') as escalatedBy,
      count(*) FILTER(WHERE statusChange.caseStatus IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')) as inProgress
    FROM cases
    ARRAY JOIN alerts AS alert
    ARRAY JOIN alert.statusChanges as statusChange
    WHERE statusChange.userId != ''
      AND statusChange.caseStatus IN ('CLOSED', 'ESCALATED', 'OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
      GROUP BY accountId, date, status
  )
  `
}

export const getAssignmentStats = (
  scope: 'CASES' | 'ALERTS',
  startTimestamp?: number,
  endTimestamp?: number
) => {
  const timeConditions: string[] = []
  if (startTimestamp) {
    timeConditions.push(`assignment.timestamp >= ${startTimestamp}`)
  }
  if (endTimestamp) {
    timeConditions.push(`assignment.timestamp <= ${endTimestamp}`)
  }
  if (scope === 'CASES') {
    return `
    assignment_counts AS (
      SELECT
        assignment.assigneeUserId as accountId,
        formatDateTime(toDateTime(assignment.timestamp/1000), '%Y-%m-%d %H:00:00') as date,
        caseStatus as status,
        count(*) as assignedTo
      FROM cases
      ARRAY JOIN assignments as assignment
      WHERE assignment.assigneeUserId != ''
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
      GROUP BY accountId, date, status
    )
    `
  }
  return `
  assignment_counts AS (
    SELECT
      assignment.assigneeUserId as accountId,
      formatDateTime(toDateTime(assignment.timestamp/1000), '%Y-%m-%d %H:00:00') as date,
      alert.alertStatus as status,
      count(*) as assignedTo
    FROM cases
    ARRAY JOIN alerts AS alert
    ARRAY JOIN alert.assignments as assignment
    WHERE assignment.assigneeUserId != ''
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
    GROUP BY accountId, date, status
  )
  `
}

export const getClosedBySystem = (
  scope: 'CASES' | 'ALERTS',
  startTimestamp?: number,
  endTimestamp?: number
) => {
  const timeConditions: string[] = []
  if (scope === 'CASES') {
    if (startTimestamp) {
      timeConditions.push(`statusChange.timestamp >= ${startTimestamp}`)
      timeConditions.push(`arrayExists(
        x -> x.timestamp >= ${startTimestamp},
        alert.statusChanges)`)
    }
    if (endTimestamp) {
      timeConditions.push(`statusChange.timestamp <= ${endTimestamp}`)
      timeConditions.push(`arrayExists(
        x -> x.timestamp <= ${endTimestamp},
        alert.statusChanges)`)
    }
    return `
    system_closed_cases AS (
      SELECT
        caseId,
        caseStatus,
        statusChange,
        arrayLast(
          x -> x.caseStatus = 'CLOSED',
          alert.statusChanges
        ) as lastStatusChange
      FROM cases
      ARRAY JOIN statusChanges AS statusChange
      Array JOIN alerts as alert
      WHERE statusChange.caseStatus = 'CLOSED'
      AND statusChange.userId = '${FLAGRIGHT_SYSTEM_USER}'
      AND arrayExists(
        x -> x.caseStatus = 'CLOSED',
        alert.statusChanges
      )
      ${timeConditions.length > 0 ? `AND ${timeConditions.join(' AND ')}` : ''}
    ),
    alert_user_groups AS (
      SELECT 
        caseId,
        any(lastStatusChange.userId) as accountId,
        any(caseStatus) as status,
        groupUniqArray(statusChange) as statusChanges
      FROM system_closed_cases
      GROUP BY caseId
      HAVING accountId IS NOT NULL
      AND count(DISTINCT lastStatusChange.userId) = 1
    ),
    closed_by_system AS (
      SELECT 
        accountId,
        status,
        formatDateTime(toDateTime(statusChange.timestamp/1000), '%Y-%m-%d %H:00:00') as date,
        count(*) as closedBySystem
      FROM alert_user_groups
      ARRAY JOIN statusChanges as statusChange
      GROUP BY 
        accountId,
        status,
        date
    )
  `
  }
  if (startTimestamp) {
    timeConditions.push(`statusChange.timestamp >= ${startTimestamp * 1000}`)
    timeConditions.push(
      `caseStatusChange.timestamp >= ${startTimestamp * 1000}`
    )
  }
  if (endTimestamp) {
    timeConditions.push(`statusChange.timestamp <= ${endTimestamp * 1000}`)
    timeConditions.push(`caseStatusChange.timestamp <= ${endTimestamp * 1000}`)
  }
  return `
  closed_by_system AS (
    SELECT
      caseStatusChange.userId as accountId,
      formatDateTime(toDateTime(caseStatusChange.timestamp/1000), '%Y-%m-%d %H:00:00') as date,
      statusChange.caseStatus as status,
      count(*) as closedBySystem
    FROM cases
    ARRAY JOIN statusChanges AS caseStatusChange
    ARRAY JOIN alerts AS alert
    ARRAY JOIN alert.statusChanges as statusChange
      WHERE statusChange.userId = '${FLAGRIGHT_SYSTEM_USER}'
        AND statusChange.caseStatus = 'CLOSED'
        AND caseStatusChange.caseStatus = 'CLOSED'
      GROUP BY accountId, date, status
  )
  `
}

export const getMaterialisedViewQuery = (
  scope: 'CASES' | 'ALERTS',
  startTimestamp?: number,
  endTimestamp?: number
) => {
  return `
          WITH
          -- Investigation time calculation
          ${getInvestigationTimes(scope, startTimestamp, endTimestamp)},
      
          -- Status changes stats
          ${getStatusStats(scope, startTimestamp, endTimestamp)},
      
          -- Assignment counts
          ${getAssignmentStats(scope, startTimestamp, endTimestamp)},
          -- Closed by system
          ${getClosedBySystem(scope, startTimestamp, endTimestamp)}
          SELECT
            COALESCE(NULLIF(i.accountId, ''), NULLIF(s.accountId, ''), NULLIF(a.accountId, ''), NULLIF(c.accountId, '')) AS accountId,
            COALESCE(NULLIF(i.date, ''), NULLIF(s.date, ''), NULLIF(a.date, ''), NULLIF(c.date, '')) AS date,
            COALESCE(NULLIF(i.status, ''), NULLIF(s.status, ''), NULLIF(a.status, ''), NULLIF(c.status, '')) AS status,
            COALESCE(s.closedBy, 0) AS closedBy,
            COALESCE(a.assignedTo, 0) AS assignedTo,
            COALESCE(i.investigationTime, 0) AS investigationTime,
            COALESCE(i.caseId, []) AS caseIds,
            COALESCE(s.inProgress, 0) AS inProgress,
            COALESCE(s.escalatedBy, 0) AS escalatedBy,
            COALESCE(c.closedBySystem, 0) AS closedBySystem
        FROM investigation_times AS i
        FULL OUTER JOIN status_stats AS s ON (i.accountId = s.accountId) AND (i.date = s.date) AND (i.status = s.status)
        FULL OUTER JOIN assignment_counts AS a ON (COALESCE(NULLIF(i.accountId, ''), NULLIF(s.accountId, '')) = a.accountId) AND (COALESCE(NULLIF(i.date, ''), NULLIF(s.date, '')) = a.date) AND (COALESCE(NULLIF(i.status, ''), NULLIF(s.status, '')) = a.status)
        FULL OUTER JOIN closed_by_system AS c ON (COALESCE(NULLIF(i.accountId, ''), NULLIF(s.accountId, ''), NULLIF(a.accountId, '')) = c.accountId) AND (COALESCE(NULLIF(i.date, ''), NULLIF(s.date, ''), NULLIF(a.date, '')) = c.date) AND (COALESCE(NULLIF(i.status, ''), NULLIF(s.status, ''), NULLIF(a.status, '')) = c.status)
        `
}

export const CASE_INVESTIGATION_STATS_MV_QUERY =
  getMaterialisedViewQuery('CASES')
export const ALERT_INVESTIGATION_STATS_MV_QUERY =
  getMaterialisedViewQuery('ALERTS')
