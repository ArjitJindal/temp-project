import { ApiUsageMetrics } from './api-usage-metrics-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT, MONTH_DATE_FORMAT_JS } from '@/core/constants'
import { Metric } from '@/core/cloudwatch/metrics'
import { METRICS_COLLECTION } from '@/utils/mongodb-definitions'
import dayjs from '@/utils/dayjs'

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

export async function getDailyUsage(
  collectionName: string,
  createAtFieldName: string,
  timeRange: { startTimestamp: number; endTimestamp: number }
): Promise<DailyStats> {
  const db = (await getMongoDbClient()).db()
  const casesCollection = db.collection(collectionName)
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

export async function getMetricValues(
  tenantId: string,
  metricName: string,
  timeRange: {
    startTimestamp: number
    endTimestamp: number
  }
): Promise<DailyStats> {
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
