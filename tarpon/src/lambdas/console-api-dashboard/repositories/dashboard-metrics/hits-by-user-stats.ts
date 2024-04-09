import { getAffectedInterval } from '../../utils'
import { CASE_GROUP_KEYS, CASE_PROJECT_KEYS, TimeRange } from '../types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  getMongoDbClientDb,
  lookupPipelineStage,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsHitsPerUserData } from '@/@types/openapi-internal/DashboardStatsHitsPerUserData'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { traceable } from '@/core/xray'

@traceable
export class HitsByUserStatsDashboardMetric {
  public static async refreshCaseStats(
    tenantId,
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const userFieldName =
      direction === 'ORIGIN'
        ? 'caseUsers.origin.userId'
        : 'caseUsers.destination.userId'

    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)

    await db.collection(aggregationCollection).createIndex(
      {
        direction: 1,
        date: -1,
        userId: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(aggregationCollection).createIndex({
      updatedAt: 1,
    })

    let timestampMatch: any = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        createdTimestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }

    const mergePipeline = [
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const casesPipeline = [
      {
        $match: {
          ...timestampMatch,
          [userFieldName]: { $ne: null },
        },
      },
      {
        $project: {
          caseTransactions: 0,
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$createdTimestamp',
                  },
                },
              },
            },
            userId: `$${userFieldName}`,
          },
          ...CASE_GROUP_KEYS,
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          userId: '$_id.userId',
          direction,
          ...CASE_PROJECT_KEYS,
        },
      },
      ...mergePipeline,
    ]

    const lastUpdatedAt = Date.now()

    // Execute the cases aggregation pipeline
    await casesCollection
      .aggregate(withUpdatedAt(casesPipeline, lastUpdatedAt), {
        allowDiskUse: true,
      })
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { direction }
    )
  }

  public static async refreshTransactionsStats(
    tenantId,
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)

    await db.collection(aggregationCollection).createIndex(
      {
        direction: 1,
        date: -1,
        userId: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(aggregationCollection).createIndex({
      updatedAt: 1,
    })
    let tranasctionTimestampMatch: any = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      tranasctionTimestampMatch = {
        timestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }

    const mergePipeline = [
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const transactionsPipeline = [
      {
        $match: {
          ...tranasctionTimestampMatch,
          [`${direction.toLowerCase()}UserId`]: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$timestamp',
                  },
                },
              },
            },
            userId: `$${direction.toLowerCase()}UserId`,
          },
          rulesHitCount: {
            $sum: {
              $size: { $ifNull: ['$hitRules', []] },
            },
          },
          rulesRunCount: {
            $sum: {
              $size: { $ifNull: ['$executedRules', []] },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          userId: '$_id.userId',
          direction,
          rulesHitCount: '$rulesHitCount',
          rulesRunCount: '$rulesRunCount',
        },
      },
      ...mergePipeline,
    ]

    const lastUpdatedAt = Date.now()

    // Execute the transactions aggregation pipeline
    await transactionsCollection
      .aggregate(withUpdatedAt(transactionsPipeline, lastUpdatedAt), {
        allowDiskUse: true,
      })
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      'date',
      lastUpdatedAt,
      timeRange,
      'HOUR',
      { direction }
    )
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION',
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<DashboardStatsHitsPerUserData[]> {
    const db = await getMongoDbClientDb()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
    )
    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    const condition = {
      $match: {
        ...(direction ? { direction } : { direction: { $exists: true } }),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    }

    const userTypeCondition = {
      $match: {
        'user.type': userType,
      },
    }

    const result = await collection
      .aggregate<{
        _id: string
        user: InternalConsumerUser | InternalBusinessUser | null
        casesCount: number
        openCasesCount: number
        rulesRunCount: number
        rulesHitCount: number
      }>(
        [
          {
            $match: {
              ...condition.$match,
              rulesRunCount: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: `$userId`,
              casesCount: { $sum: '$casesCount' },
              openCasesCount: { $sum: '$openCasesCount' },
              rulesRunCount: { $sum: '$rulesRunCount' },
              rulesHitCount: { $sum: '$rulesHitCount' },
            },
          },
          {
            $match: {
              rulesHitCount: { $gt: 0 },
            },
          },
          {
            $sort: { rulesHitCount: -1 },
          },
          {
            $limit: 10,
          },
          lookupPipelineStage(
            {
              from: USERS_COLLECTION(tenantId),
              localField: '_id',
              foreignField: 'userId',
              as: 'user',
            },
            true
          ),
          userTypeCondition,
          {
            $set: {
              user: { $first: '$user' },
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => {
      return {
        userId: x._id,
        user: x.user ?? undefined,
        rulesHitCount: x.rulesHitCount,
        casesCount: x.casesCount,
        openCasesCount: x.openCasesCount,
        rulesRunCount: x.rulesRunCount,
      }
    })
  }
}
