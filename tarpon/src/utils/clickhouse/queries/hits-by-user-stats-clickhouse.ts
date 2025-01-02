import { CLICKHOUSE_DEFINITIONS } from '../definition'

export const getHitsByUserStatsClickhouseQuery = (
  startTimestamp: number,
  endTimestamp: number,
  direction: string
) => {
  const userFieldName =
    direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
  const timeFilterAlerts: string[] = []
  const timeFilterTransactions: string[] = []
  if (startTimestamp) {
    timeFilterAlerts.push(`alerts.createdTimestamp >= ${startTimestamp}`)
    timeFilterTransactions.push(`timestamp >= ${startTimestamp}`)
  }
  if (endTimestamp) {
    timeFilterAlerts.push(`alerts.createdTimestamp <= ${endTimestamp}`)
    timeFilterTransactions.push(`timestamp <= ${endTimestamp}`)
  }
  return `
    WITH
        alerts_hits_by_user_stats_${direction.toLowerCase()} AS (
            SELECT 
                formatDateTime(toDateTime(alerts.createdTimestamp / 1000), '%Y-%m-%d %H:00:00') as date,
                ${userFieldName} as userId,
                count() as openAlertsCount
            FROM ${CLICKHOUSE_DEFINITIONS.CASES.tableName}
            ARRAY JOIN alerts as alerts
            WHERE 
                userId IS NOT NULL
                AND userId!=''
                ${
                  timeFilterAlerts.length > 0
                    ? `AND ${timeFilterAlerts.join(' AND ')}`
                    : ''
                }
                AND alerts.alertStatus != 'CLOSED'
            GROUP BY 
                date,
                userId
        ),
        transactions_hits_by_user_stats_${direction.toLowerCase()} AS (
            SELECT 
                formatDateTime(toDateTime(timestamp/1000), '%Y-%m-%d %H:00:00') as date,
                ${userFieldName} as userId,
                sum(length(nonShadowHitRules)) as rulesHitCount,
                sum(length(nonShadowExecutedRules)) as rulesRunCount
            FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName}
            WHERE 
                userId IS NOT NULL
                AND userId!=''
                ${
                  timeFilterTransactions.length > 0
                    ? `AND ${timeFilterTransactions.join(' AND ')}`
                    : ''
                }
            GROUP BY date, userId
        )
        select
            coalesce(NULLIF(a.date, ''), NULLIF(t.date, '')) as date,
            coalesce(NULLIF(a.userId, ''), NULLIF(t.userId, '')) as userId,
            coalesce(a.openAlertsCount, 0) as openAlertsCount,
            coalesce(t.rulesHitCount, 0) as rulesHitCount,
            coalesce(t.rulesRunCount, 0) as rulesRunCount,
            '${direction}' as direction
        from alerts_hits_by_user_stats_${direction.toLowerCase()} as a
        full outer join transactions_hits_by_user_stats_${direction.toLowerCase()} as t
        on a.date = t.date
        and a.userId = t.userId
  `
}
