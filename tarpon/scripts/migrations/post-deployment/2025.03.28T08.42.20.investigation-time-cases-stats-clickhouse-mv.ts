import { migrateAllTenants } from '../utils/tenant'
import {
  ClickHouseTables,
  CLICKHOUSE_DEFINITIONS,
} from '@/utils/clickhouse/definition'
import {
  createMaterializedViewQuery,
  createMaterializedTableQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
    return
  }
  const tableName = CLICKHOUSE_DEFINITIONS.CASES.tableName
  const client = await getClickhouseClient(tenant.id)
  const casesClickHouseTable = ClickHouseTables.find(
    (t) => t.table === CLICKHOUSE_DEFINITIONS.CASES.tableName
  )
  if (!casesClickHouseTable) {
    throw new Error('Cases table not found')
  }
  for (const view of casesClickHouseTable.materializedViews || []) {
    if (
      view.viewName ===
      CLICKHOUSE_DEFINITIONS.CASES.materializedViews
        .INVESTIGATION_TIMES_HOURLY_STATS.viewName
    ) {
      await client.query({ query: `DROP VIEW IF EXISTS ${view.viewName}` })
      await client.query({ query: `DROP TABLE IF EXISTS ${view.table}` })
      const createViewQuery = createMaterializedTableQuery(view)
      await client.query({ query: createViewQuery })
      const matQuery = await createMaterializedViewQuery(view, view.table)
      await client.query({ query: matQuery })
      const backFillQuery = `
INSERT INTO ${view.table} (accountId, time, investigationTime, caseId, status)
SELECT
    assignment.assigneeUserId AS accountId,
    toStartOfHour(toDateTime(end_ts / 1000)) AS time,
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
            if(statusChanges[idx].2 = 'ESCALATED_IN_PROGRESS',
              reviewAssignments,
              assignments) as relevant_assignments
        FROM ${tableName} FINAL
        ARRAY JOIN arrayEnumerate(statusChanges) AS idx
        WHERE length(statusChanges) > 1
            AND idx < length(statusChanges)
            AND statusChanges[idx].2 IN ('OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS')
    ) AS subquery
ARRAY JOIN relevant_assignments AS assignment
WHERE assignment.assigneeUserId != ''
GROUP BY
    accountId,
    time,
    status;`
      await client.query({ query: backFillQuery })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
