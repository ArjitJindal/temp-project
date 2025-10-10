export const getCreateInvestigationTimesStatsClickhouseMVQuery = `
SELECT
    assignment.assigneeUserId AS accountId,
    toStartOfHour(toDateTime(end_ts / 1000)) AS time,
    --toDateTime(formatDateTime(toDateTime(end_ts/1000), '%Y-%m-%d %H:00:00')) AS time,
    sum(toUInt64(end_ts - start_ts)) AS investigationTime,
    groupUniqArray(caseId) AS caseId,
    multiIf(
        caseStatus IN ('OPEN_IN_PROGRESS', 'OPEN_ON_HOLD'), 'OPEN',
        caseStatus IN ('ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD'), 'ESCALATED',
        caseStatus
    ) AS status
FROM 
    (
        SELECT
            caseId,
            caseStatus,
            statusChanges[idx].1 AS start_ts,
            statusChanges[idx + 1].1 AS end_ts,
            if(statusChanges[idx].2 = 'ESCALATED_IN_PROGRESS', reviewAssignments, assignments) AS relevant_assignments
        FROM cases 
        ARRAY JOIN arrayEnumerate(statusChanges) AS idx
        WHERE length(statusChanges) > 1
            AND idx < length(statusChanges)
            AND statusChanges[idx].2 IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
    ) AS subquery
ARRAY JOIN relevant_assignments AS assignment
WHERE assignment.assigneeUserId != '' AND assignment.assigneeUserId IS NOT NULL
GROUP BY
    accountId,
    time,
    status
`

export const insertInvestigationTimesStatsClickhouseMVQuery = `
INSERT INTO investigation_time_hourly
SELECT
    assignment.assigneeUserId as accountId,
    toDateTime(formatDateTime(toDateTime(end_ts/1000), '%Y-%m-%d %H:00:00')) as date,
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
      statusChanges[idx].1 as start_ts,
      statusChanges[idx + 1].1 as end_ts,
      if(statusChanges[idx].2 = 'ESCALATED_IN_PROGRESS',
          reviewAssignments,
          assignments) as relevant_assignments
    FROM cases FINAL
    ARRAY JOIN arrayEnumerate(statusChanges) as idx
    WHERE length(statusChanges) > 1
      AND idx < length(statusChanges)
      AND statusChanges[idx].2 IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
)
ARRAY JOIN relevant_assignments AS assignment
WHERE assignment.assigneeUserId != '' AND assignment.assigneeUserId IS NOT NULL
GROUP BY
    accountId,
    date,
    status;
`

export const investigationTimesStatsColumns = [
  {
    name: 'time',
    type: 'DateTime',
  },
  { name: 'accountId', type: 'String' },
  { name: 'investigationTime', type: 'UInt64' },
  { name: 'caseId', type: 'Array(String)' },
  { name: 'status', type: 'String' },
]
