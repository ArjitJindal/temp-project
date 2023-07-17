import _ from 'lodash'
import { DAY_DATE_FORMAT, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Metric } from '@/core/cloudwatch/metrics'

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
