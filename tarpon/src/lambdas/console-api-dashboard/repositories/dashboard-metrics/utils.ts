import { Document, Filter } from 'mongodb'
import { TimeRange } from '../types'
import { getAffectedInterval } from '../../utils'
import {
  getDateFormatByGranularity,
  getDateFormatJsByGranularity,
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
    const dateFormat = getDateFormatJsByGranularity(timeRangeGranularity)
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

export function getAttributeCountStatsPipeline(
  aggregationCollection: string,
  granularity: 'HOUR' | 'DAY' | 'MONTH',
  timestampField: string,
  attributePrefix: string,
  attributeFields: string[],
  timeRange?: TimeRange,
  options?: {
    attributeFieldMapper?: any
  }
) {
  let timestampMatch: any = undefined
  if (timeRange) {
    const { start, end } = getAffectedInterval(timeRange, granularity)
    timestampMatch = {
      [timestampField]: {
        $gte: start,
        $lt: end,
      },
    }
  }
  return [
    { $match: { ...timestampMatch } },
    {
      $addFields: {
        targetFields: attributeFields.map((f) => `$${f}`),
      },
    },
    {
      $unwind: {
        path: '$targetFields',
        preserveNullAndEmptyArrays: false,
      },
    },
    ...(options?.attributeFieldMapper
      ? [
          {
            $set: { targetFields: options.attributeFieldMapper },
          },
        ]
      : []),
    {
      $match: {
        targetFields: { $ne: null },
      },
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: getDateFormatByGranularity(granularity),
              date: {
                $toDate: {
                  $toLong: `$${timestampField}`,
                },
              },
            },
          },
          attr: {
            $concat: [`${attributePrefix}_`, '$targetFields'],
          },
        },
        count: {
          $count: {},
        },
      },
    },
    {
      $group: {
        _id: '$_id.date',
        items: {
          $addToSet: {
            k: '$_id.attr',
            v: '$count',
          },
        },
      },
    },
    {
      $project: {
        items: {
          $arrayToObject: '$items',
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            {
              _id: '$_id',
            },
            '$items',
          ],
        },
      },
    },
    {
      $merge: {
        into: aggregationCollection,
        whenMatched: 'merge',
      },
    },
  ]
}

export function getAttributeSumStatsDerivedPipeline(
  destAggregationCollection: string,
  granularity: 'HOUR' | 'DAY' | 'MONTH',
  timeRange?: TimeRange
) {
  let timestampMatch: any = undefined
  if (timeRange) {
    const { start, end } = getAffectedInterval(timeRange, granularity)
    const format = getDateFormatJsByGranularity(granularity)
    timestampMatch = {
      _id: {
        $gte: dayjs(start).format(format),
        $lt: dayjs(end).format(format),
      },
    }
  }
  return [
    { $match: { ...timestampMatch } },
    {
      $addFields: {
        time: {
          $substr: ['$_id', 0, granularity === 'DAY' ? 10 : 7],
        },
        fieldsArray: {
          $objectToArray: '$$ROOT',
        },
      },
    },
    {
      $unwind: '$fieldsArray',
    },
    {
      $match: {
        'fieldsArray.k': {
          $nin: ['_id', 'updatedAt'],
        },
      },
    },
    {
      $group: {
        _id: {
          time: '$time',
          k: '$fieldsArray.k',
        },
        v: { $sum: '$fieldsArray.v' },
      },
    },
    {
      $group: {
        _id: '$_id.time',
        fields: { $push: { k: '$_id.k', v: '$v' } },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            {
              _id: '$_id',
            },
            {
              $arrayToObject: '$fields',
            },
          ],
        },
      },
    },
    {
      $merge: {
        into: destAggregationCollection,
        whenMatched: 'merge',
      },
    },
  ]
}
