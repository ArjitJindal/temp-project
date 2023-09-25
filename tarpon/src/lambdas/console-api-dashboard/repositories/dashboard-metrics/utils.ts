import { Document, Filter } from 'mongodb'
import { TimeRange } from '../types'
import { getAffectedInterval } from '../../utils'
import {
  getDateFormatByGranularity,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'

export function withUpdatedAt(
  pipeline: Document[],
  updatedAt: number
): Document[] {
  return pipeline
    .slice(0, pipeline.length - 1)
    .concat({
      $addFields: {
        updatedAt,
      },
    })
    .concat(pipeline[pipeline.length - 1])
}

export async function cleanUpStaleData(
  collection: string,
  timeField: string,
  latUpdatedAt: number,
  timeRange?: TimeRange,
  timeRangeGranularity: 'HOUR' | 'DAY' | 'MONTH' = 'HOUR',
  additionalMatch: Filter<any> = {}
) {
  const db = await getMongoDbClientDb()
  let timeCondition = {}
  if (timeRange) {
    const { start, end } = getAffectedInterval(
      timeRange ?? {},
      timeRangeGranularity
    )
    const dateFormat = getDateFormatByGranularity(timeRangeGranularity)
    timeCondition = {
      [timeField]: {
        $gte: dayjs(start).format(dateFormat),
        $lt: dayjs(end).format(dateFormat),
      },
    }
  }
  await db.collection(collection).deleteMany({
    updatedAt: {
      $lt: latUpdatedAt,
    },
    ...timeCondition,
    ...additionalMatch,
  })
}
