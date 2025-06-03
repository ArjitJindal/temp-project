import { ClickHouseClient } from '@clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { RuleInstanceAlertsStats } from '@/@types/openapi-internal/RuleInstanceAlertsStats'

@traceable
export class RuleInstanceClickhouseRepository {
  clickhouseClient: ClickHouseClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      clickhouseClient: ClickHouseClient
    }
  ) {
    this.tenantId = tenantId
    this.clickhouseClient = connections.clickhouseClient
  }

  public async getRuleInstanceStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number },
    ruleInstance: RuleInstance,
    isShadow: boolean
  ): Promise<{
    stats: { [key: string]: { [key: string]: number } }
  }> {
    if (ruleInstance.type === 'TRANSACTION') {
      const hitStatsQuery = `
        WITH hit_stats AS (
          SELECT 
            toString(toDate(timestamp/1000)) as time,
            COUNT(*) as hitCount,
            uniqExact(
              arrayJoin(
                arrayMap(x -> 
                  arrayConcat(
                    if(hasAny(tupleElement(x, 'hitDirections'), ['"ORIGIN"']), [originUserId], []),
                    if(hasAny(tupleElement(x, 'hitDirections'), ['"DESTINATION"']), [destinationUserId], [])
                  ),
                  arrayFilter(x -> 
                    tupleElement(x, 'ruleInstanceId') = '${ruleInstanceId}' AND 
                    tupleElement(x, 'isShadow') = ${isShadow},
                    hitRulesWithMeta
                  )
                )
              )
            ) as hitUsersCount
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
            AND hasAny(
              arrayMap(x -> tupleElement(x, 'ruleInstanceId'),
                arrayFilter(x -> tupleElement(x, 'isShadow') = ${isShadow}, 
                hitRulesWithMeta)
              ),
              ['${ruleInstanceId}']
            )
          GROUP BY time
        ),
        run_stats AS (
          SELECT
            toString(toDate(timestamp/1000)) as time,
            COUNT(*) as runCount
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
            AND has(ruleInstancesExecuted, '${ruleInstanceId}')
          GROUP BY time
        )
        SELECT
          time,
          hitCount,
          hitUsersCount,
          runCount
        FROM hit_stats
        FULL OUTER JOIN run_stats USING (time)
        ORDER BY time
      `

      const rows = await executeClickhouseQuery<
        Array<{
          time: string
          hitCount: number
          hitUsersCount: number
          runCount: number
        }>
      >(this.clickhouseClient, {
        query: hitStatsQuery,
        format: 'JSONEachRow',
      })

      const stats = rows.reduce(
        (acc, row) => ({
          ...acc,
          [row.time]: {
            hitCount: Number(row.hitCount),
            hitUsersCount: Number(row.hitUsersCount),
            runCount: Number(row.runCount),
          },
        }),
        {}
      )
      return { stats }
    } else if (ruleInstance.type === 'USER') {
      const query = `
      WITH run_stats AS (
        SELECT
          toString(toDate(executedRules.2/1000)) as date,
          count() as runCount
        FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
        ARRAY JOIN executedRules
        WHERE executedRules.2 BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
          AND executedRules.1 = '${ruleInstanceId}'
          AND executedRules.3 = ${isShadow}
        GROUP BY date
      ),
      hit_stats AS (
        SELECT
          toString(toDate(hitRules.2/1000)) as date,
          count() as hitCount
        FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
        ARRAY JOIN hitRules
        WHERE hitRules.2 BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
          AND hitRules.1 = '${ruleInstanceId}'
          AND hitRules.3 = ${isShadow}
        GROUP BY date
      )
      SELECT
        coalesce(NULLIF(r.date, ''), NULLIF(h.date, '')) as date,
        coalesce(r.runCount, 0) as runCount,
        coalesce(h.hitCount, 0) as hitCount
      FROM run_stats r
      FULL OUTER JOIN hit_stats h ON r.date = h.date
      ORDER BY date
    `

      const rows = await executeClickhouseQuery<
        Array<{
          date: string
          hitCount: number
          runCount: number
        }>
      >(this.clickhouseClient, {
        query,
        format: 'JSONEachRow',
      })

      const stats = rows.reduce(
        (acc, row) => ({
          ...acc,
          [row.date]: {
            hitCount: Number(row.hitCount),
            runCount: Number(row.runCount),
          },
        }),
        {}
      )
      return { stats }
    }
    return { stats: {} }
  }

  public async getAlertStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ) {
    const query = `
      SELECT
        toString(toDate(alerts.createdTimestamp/1000)) as date,
        count() as alertsCreated,
        countIf(hasAny(alerts.lastStatusChangeReasons, ['"False positive"'])) as falsePositiveAlerts
      FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName} FINAL
      ARRAY JOIN alerts
      WHERE alerts.createdTimestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
        AND alerts.ruleInstanceId = '${ruleInstanceId}'
      GROUP BY date
      ORDER BY date
    `

    return await executeClickhouseQuery<RuleInstanceAlertsStats[]>(
      this.clickhouseClient,
      { query, format: 'JSONEachRow' }
    )
  }
}
