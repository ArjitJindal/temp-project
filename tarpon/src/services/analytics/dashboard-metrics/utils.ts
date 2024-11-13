import { Db, Document, Filter } from 'mongodb'
import { TimeRange } from '../../dashboard/repositories/types'
import { getAffectedInterval } from '../../dashboard/utils'
import {
  getDateFormatByGranularity,
  getDateFormatJsByGranularity,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import { AccountsService } from '@/services/accounts'

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
  lastUpdatedAt: number,
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
      $lt: lastUpdatedAt,
    },
    ...timeCondition,
    ...additionalMatch,
  })
  await db.collection(collection).updateMany(
    {
      updatedAt: {
        $gte: lastUpdatedAt,
      },
      ...additionalMatch,
    },
    { $unset: { ready: '' } }
  )
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
              time: '$_id',
            },
            '$items',
          ],
        },
      },
    },
    {
      $addFields: {
        ready: false,
      },
    },
    {
      $merge: {
        into: aggregationCollection,
        on: ['time', 'ready'],
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
      time: {
        $gte: dayjs(start).format(format),
        $lt: dayjs(end).format(format),
      },
    }
  }
  return [
    { $match: { ...timestampMatch } },
    {
      $addFields: {
        newTime: {
          $substr: ['$time', 0, granularity === 'DAY' ? 10 : 7],
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
          $nin: ['time', 'updatedAt'],
        },
      },
    },
    {
      $group: {
        _id: {
          time: '$newTime',
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
              time: '$_id',
            },
            {
              $arrayToObject: '$fields',
            },
          ],
        },
      },
    },
    {
      $addFields: {
        ready: false,
      },
    },
    {
      $unset: '_id',
    },
    {
      $merge: {
        into: destAggregationCollection,
        on: ['time', 'ready'],
        whenMatched: 'merge',
      },
    },
  ]
}

export const updateRoles = async (db: Db, collectionName: string) => {
  const accountsService = await AccountsService.getInstance()
  const collection = db.collection(collectionName)
  const accounts = await collection.distinct('accountId')

  for (const accountId of accounts) {
    try {
      let role: string
      if (accountId.startsWith('auth0')) {
        const account = await accountsService.getAccount(accountId)
        if (account === null) {
          continue
        }
        role = account.role
      } else {
        role = 'other'
      }

      await collection.updateOne(
        { accountId },
        { $set: { role } },
        { upsert: true }
      )
    } catch (error) {
      console.error(
        `Failed to fetch or update role for account ${accountId}:`,
        error
      )
    }
  }
}
