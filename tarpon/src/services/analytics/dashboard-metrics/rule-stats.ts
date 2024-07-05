import { getAffectedInterval } from '../../dashboard/utils'
import {
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
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

@traceable
export class RuleHitsStatsDashboardMetric {
  public static async refreshAlertsStats(
    tenantId,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    await this.createIndexes(tenantId)
    let timestampMatch: any = undefined

    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        'alerts.createdTimestamp': {
          $gte: start,
          $lt: end,
        },
      }
    }

    const pipeline = [
      {
        $match: { ...timestampMatch },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: { ...timestampMatch },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$alerts.createdTimestamp',
                  },
                },
              },
            },
            ruleId: '$alerts.ruleId',
            ruleInstanceId: '$alerts.ruleInstanceId',
          },
          ruleHitCount: {
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.numberOfTransactionsHit', 0] },
                then: 1,
                else: 0,
              },
            },
          },
          openAlertsCount: {
            $sum: {
              $cond: {
                if: { $ne: ['$alerts.alertStatus', 'CLOSED'] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          ruleId: '$_id.ruleId',
          ruleInstanceId: '$_id.ruleInstanceId',
          hitCount: '$rulesHitCount',
          openAlertsCount: '$openAlertsCount',
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          on: ['date', 'ruleId', 'ruleInstanceId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
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
      { openAlertsCount: { $exists: true } }
    )
  }

  public static async refreshTransactionsStats(
    tenantId,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    await this.createIndexes(tenantId)
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

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
          on: ['date', 'ruleId', 'ruleInstanceId'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const transactionsPipeline = [
      {
        $match: {
          ...tranasctionTimestampMatch,
        },
      },
      {
        $unwind: { path: '$hitRules' },
      },
      {
        $match: {
          'hitRules.ruleId': { $exists: true },
          'hitRules.ruleInstanceId': { $exists: true },
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
            ruleId: '$hitRules.ruleId',
            ruleInstanceId: '$hitRules.ruleInstanceId',
          },
          rulesHitCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          ruleId: '$_id.ruleId',
          ruleInstanceId: '$_id.ruleInstanceId',
          hitCount: '$rulesHitCount',
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
      { hitCount: { $exists: true } }
    )
  }

  private static async createIndexes(tenantId: string) {
    const db = await getMongoDbClientDb()
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

    await db.collection(aggregationCollection).createIndex(
      {
        ruleId: 1,
        date: -1,
        ruleInstanceId: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(aggregationCollection).createIndex({
      updatedAt: 1,
      date: 1,
    })
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
        openAlertsCount: number
      }>(
        [
          {
            $match: {
              date: {
                $gte: startDateText,
                $lte: endDateText,
              },
            },
          },
          {
            $group: {
              _id: {
                ruleId: '$ruleId',
                ruleInstanceId: '$ruleInstanceId',
              },
              hitCount: { $sum: '$hitCount' },
              openAlertsCount: { $sum: '$openAlertsCount' },
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
      openAlertsCount: x.openAlertsCount,
    }))
  }
}
