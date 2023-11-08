import { round } from 'lodash'
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
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsHitsPerUserData } from '@/@types/openapi-internal/DashboardStatsHitsPerUserData'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { traceable } from '@/core/xray'

@traceable
export class HitsByUserStatsDashboardMetric {
  public static async refresh(
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
    const pipeline = [
      {
        $match: {
          ...timestampMatch,
          // NOTE: We only aggregate the stats for known users
          [userFieldName]: { $ne: null },
        },
      },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
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
          rulesHit: {
            $sum: { $size: { $ifNull: ['$caseTransactions.hitRules', []] } },
          },
          transactionsHit: {
            $sum: 1,
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
          rulesHit: '$rulesHit',
          transactionsHit: '$transactionsHit',
          ...CASE_PROJECT_KEYS,
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
        },
      },
    ]
    const lastUpdatedAt = Date.now()
    await casesCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
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
        ...(direction ? { direction } : {}),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    }

    const totalRulesHits = await collection
      .aggregate<{
        _id: null
        totalRulesHits: number
      }>([
        condition,
        {
          $group: {
            _id: null,
            totalRulesHits: { $sum: '$rulesHit' },
          },
        },
      ])
      .next()
      .then((result) => result?.totalRulesHits ?? 0)

    const userTypeCondition = {
      $match: {
        'user.type': userType,
      },
    }

    const result = await collection
      .aggregate<{
        _id: string
        transactionsHit: number
        rulesHit: number
        user: InternalConsumerUser | InternalBusinessUser | null
        casesCount: number
        openCasesCount: number
      }>(
        [
          condition,
          {
            $group: {
              _id: `$userId`,
              transactionsHit: { $sum: '$transactionsHit' },
              rulesHit: { $sum: '$rulesHit' },
              casesCount: { $sum: '$casesCount' },
              openCasesCount: { $sum: '$openCasesCount' },
            },
          },
          {
            $sort: { rulesHit: -1 },
          },
          {
            $match: {
              rulesHit: {
                $gte: 1,
              },
            },
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
          {
            $set: {
              user: { $first: '$user' },
            },
          },
          userTypeCondition,
          {
            $limit: 10,
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      userId: x._id,
      user: x.user ?? undefined,
      transactionsHit: x.transactionsHit,
      rulesHit: x.rulesHit,
      casesCount: x.casesCount,
      openCasesCount: x.openCasesCount,
      percentageRulesHit: round((x.rulesHit / totalRulesHits) * 100, 2),
    }))
  }
}
