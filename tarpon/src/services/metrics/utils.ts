import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT, MONTH_DATE_FORMAT_JS } from '@/core/constants'
import { Metric } from '@/core/cloudwatch/metrics'
import { METRICS_COLLECTION } from '@/utils/mongodb-definitions'
import dayjs from '@/utils/dayjs'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

export type DailyStats = { [dayLabel: string]: number }
export type DailyMetricStats = {
  date: string // e.g 2023-01-01
  values: Array<{
    metric: Metric
    value: number
  }>
}
export type MonthlyMetricStats = {
  month: string // e.g 2023-01
  values: Array<{
    metric: Metric
    value: number
  }>
}

export type ApiUsageMetrics = {
  name: string
  value: string | number | undefined
  date: string
  collectedTimestamp: number
}

export async function getDailyUsage(
  tenantId: string,
  collection: { mongo: string; clickHouse: string },
  createAtFieldName: string,
  timeRange: { startTimestamp: number; endTimestamp: number }
): Promise<DailyStats> {
  if (isClickhouseMigrationEnabled()) {
    return getDailyUsageFromClickhouse(
      tenantId,
      collection.clickHouse,
      timeRange
    )
  }
  const db = (await getMongoDbClient()).db()
  const casesCollection = db.collection(collection.mongo)
  const result = await casesCollection
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          [createAtFieldName]: {
            $gte: timeRange.startTimestamp,
            $lte: timeRange.endTimestamp,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: DAY_DATE_FORMAT,
              date: {
                $toDate: {
                  $toLong: `$${createAtFieldName}`,
                },
              },
            },
          },
          count: {
            $sum: 1,
          },
        },
      },
    ])
    .toArray()
  return Object.fromEntries(result.map((item) => [item._id, item.count]))
}

export async function getDailyUsageFromClickhouse(
  tenantId: string,
  clickHouseTableName: string,
  timeRange: { startTimestamp: number; endTimestamp: number }
): Promise<DailyStats> {
  const client = await getClickhouseClient(tenantId)

  const query = `
    SELECT 
        toDate(toDateTime(timestamp / 1000)) as date,
        count(*) as count
    FROM ${clickHouseTableName} FINAL
    WHERE toDateTime(timestamp / 1000) BETWEEN toDateTime(${timeRange.startTimestamp} / 1000) AND toDateTime(${timeRange.endTimestamp} / 1000)
    AND timestamp != 0
    GROUP BY date
  `
  const data = await executeClickhouseQuery<
    Array<{ date: string; count: number }>
  >(client, {
    query,
    format: 'JSONEachRow',
  })
  return Object.fromEntries(
    data.map((item) => [item.date, item.count as number])
  )
}

export async function getMetricValues(
  tenantId: string,
  metricName: string,
  timeRange: {
    startTimestamp: number
    endTimestamp: number
  }
): Promise<DailyStats> {
  if (isClickhouseMigrationEnabled()) {
    const client = await getClickhouseClient(tenantId)
    const query = `
      SELECT 
        formatDateTime(date, '%Y-%m-%d') as date,
        name,
        value
      FROM ${CLICKHOUSE_DEFINITIONS.METRICS.tableName} FINAL
      WHERE toDateTime(date) BETWEEN toDateTime(${timeRange.startTimestamp} / 1000) AND toDateTime(${timeRange.endTimestamp} / 1000)
        AND name = '${metricName}'
      ORDER BY date
    `
    const data = await executeClickhouseQuery<
      Array<{ date: string; value: number; name: string }>
    >(client, {
      query,
      format: 'JSONEachRow',
    })
    return Object.fromEntries(
      data.map((item) => [item.date, item.value as number])
    )
  }
  const db = (await getMongoDbClient()).db()
  const casesCollection = db.collection(METRICS_COLLECTION(tenantId))
  const result = await casesCollection
    .aggregate<ApiUsageMetrics>([
      {
        $match: {
          date: {
            $gte: dayjs(timeRange.startTimestamp).format(MONTH_DATE_FORMAT_JS),
            $lte: dayjs(timeRange.endTimestamp).format(MONTH_DATE_FORMAT_JS),
          },
          name: metricName,
        },
      },
    ])
    .toArray()
  return Object.fromEntries(
    result.map((item) => [item.date, item.value as number])
  )
}
