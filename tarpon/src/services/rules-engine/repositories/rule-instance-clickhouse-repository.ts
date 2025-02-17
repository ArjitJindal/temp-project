import { ClickHouseClient } from '@clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'

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
                arrayConcat(
                  if(${isShadow},
                    if(has(originShadowHitRuleIds, '${ruleInstanceId}'), [originUserId], []),
                    if(has(originNonShadowHitRuleIds, '${ruleInstanceId}'), [originUserId], [])
                  ),
                  if(${isShadow},
                    if(has(destinationShadowHitRuleIds, '${ruleInstanceId}'), [destinationUserId], []),
                    if(has(destinationNonShadowHitRuleIds, '${ruleInstanceId}'), [destinationUserId], [])
                  )
                )
              )
            ) as hitUsersCount
          FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
          WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${timeRange.beforeTimestamp}
            AND if(${isShadow},
              has(originShadowHitRuleIds, '${ruleInstanceId}') OR has(destinationShadowHitRuleIds, '${ruleInstanceId}'),
              has(originNonShadowHitRuleIds, '${ruleInstanceId}') OR has(destinationNonShadowHitRuleIds, '${ruleInstanceId}')
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
      const results = await this.clickhouseClient.query({
        query: hitStatsQuery,
        format: 'JSONEachRow',
      })

      const rows = await results.json<{
        time: string
        hitCount: number
        hitUsersCount: number
        runCount: number
      }>()

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
        SELECT
          toString(toDate(timestamp/1000)) as time,
          COUNT(*) as hitCount,
          COUNT(*) as runCount
        FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName} FINAL
        WHERE timestamp BETWEEN ${timeRange.afterTimestamp} AND ${
        timeRange.beforeTimestamp
      }
          AND has(ruleInstancesHit, '${ruleInstanceId}')
          AND (${
            isShadow
              ? `has(ruleInstancesExecuted, '${ruleInstanceId}')`
              : `has(nonShadowHitRules, '${ruleInstanceId}')`
          })
        GROUP BY time
        ORDER BY time
      `
      const results = await this.clickhouseClient.query({
        query,
        format: 'JSONEachRow',
      })

      const rows = await results.json<{
        time: string
        hitCount: number
        runCount: number
      }>()

      const stats = rows.reduce(
        (acc, row) => ({
          ...acc,
          [row.time]: {
            hitCount: Number(row.hitCount),
            runCount: Number(row.runCount),
          },
        }),
        {}
      )

      return { stats }
    }

    throw new Error('Unsupported rule type')
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
    const results = await this.clickhouseClient.query({
      query,
      format: 'JSONEachRow',
    })

    return results.json<{
      date: string
      alertsCreated: number
      falsePositiveAlerts: number
    }>()
  }
}
