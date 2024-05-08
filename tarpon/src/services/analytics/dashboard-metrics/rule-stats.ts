import { getAffectedInterval } from '../../dashboard/utils'
import {
  CASE_GROUP_KEYS,
  CASE_PROJECT_KEYS,
  DashboardStatsRiskLevelDistributionData,
  TimeRange,
} from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { DashboardStatsRulesCountData } from '@/@types/openapi-internal/DashboardStatsRulesCountData'
import { traceable } from '@/core/xray'

@traceable
export class RuleHitsStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    let timestampMatch: any = undefined

    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        updatedAt: {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      { $match: { ...timestampMatch } },
      {
        $lookup: {
          from: TRANSACTIONS_COLLECTION(tenantId),
          localField: 'caseTransactionsIds',
          foreignField: 'transactionId',
          as: 'caseTransactions',
          pipeline: [
            {
              $project: {
                transactionId: 1,
                hitRules: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $addFields: {
          userHitRules: {
            $concatArrays: [
              {
                $ifNull: ['$caseUsers.origin.hitRules', []],
              },
              {
                $ifNull: ['$caseUsers.destination.hitRules', []],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          allHitRules: {
            $concatArrays: ['$caseTransactions.hitRules', '$userHitRules'],
          },
        },
      },
      {
        $unwind: {
          path: '$allHitRules',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$createdTimestamp',
                  },
                },
              },
            },
            ruleId: '$allHitRules.ruleId',
            ruleInstanceId: '$allHitRules.ruleInstanceId',
          },
          hitCount: {
            $sum: 1,
          },
          ...CASE_GROUP_KEYS,
        },
      },
      {
        $group: {
          _id: '$_id.time',
          rulesStats: {
            $push: {
              ruleId: '$_id.ruleId',
              ruleInstanceId: '$_id.ruleInstanceId',
              hitCount: '$hitCount',
              ...CASE_PROJECT_KEYS,
            },
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

    const lastUpdatedAt = Date.now()
    await casesCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      '_id',
      lastUpdatedAt,
      timeRange,
      'HOUR'
    )
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsRulesCountData[]> {
    const db = await getMongoDbClientDb()
    const collection = db.collection<DashboardStatsRiskLevelDistributionData>(
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: { ruleId: string; ruleInstanceId: string }
        hitCount: number
        casesCount: number
        openCasesCount: number
      }>(
        [
          {
            $match: {
              _id: {
                $gt: startDateText,
                $lte: endDateText,
              },
            },
          },
          { $unwind: { path: '$rulesStats' } },
          {
            $group: {
              _id: {
                ruleId: '$rulesStats.ruleId',
                ruleInstanceId: '$rulesStats.ruleInstanceId',
              },
              hitCount: { $sum: '$rulesStats.hitCount' },
              casesCount: { $sum: '$rulesStats.casesCount' },
              openCasesCount: { $sum: '$rulesStats.openCasesCount' },
            },
          },
          { $sort: { hitCount: -1 } },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      ruleId: x._id.ruleId,
      ruleInstanceId: x._id.ruleInstanceId,
      hitCount: x.hitCount,
      casesCount: x.casesCount,
      openCasesCount: x.openCasesCount,
    }))
  }
}
