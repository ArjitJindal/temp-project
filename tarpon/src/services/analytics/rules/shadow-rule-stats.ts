import { TimeRange } from '../../dashboard/repositories/types'
import {
  getMongoDbClientDb,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
} from '@/utils/mongodb-utils'
import {
  SHADOW_RULE_ANALYTICS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getAffectedInterval } from '@/services/dashboard/utils'
import { OverviewStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/overview-stats'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import dayjs from '@/utils/dayjs'
import { ShadowRuleStats } from '@/@types/openapi-internal/ShadowRuleStats'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export class ShadowRuleStatsAnalytics {
  public static async refresh(
    tenantId: string,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const shadowRuleAnalyticsCollectionName =
      SHADOW_RULE_ANALYTICS_COLLECTION_HOURLY(tenantId)

    const shadowRuleAnalyticsCollection = db.collection<{
      transactionIdsCount: number
      userIds: string[]
      investigationTime: number
      ruleInstanceId: string
      time: string
    }>(shadowRuleAnalyticsCollectionName)

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

    const averageAlertsInvestigationTime =
      await OverviewStatsDashboardMetric.getAverageInvestigationTime(
        tenantId,
        'alerts'
      )

    await shadowRuleAnalyticsCollection.createIndex(
      { ruleInstanceId: 1, time: 1 },
      { unique: true }
    )

    const transactionsPipeline = [
      { $match: { ...timestampMatch, 'hitRules.isShadow': true } },
      {
        $project: {
          transactionId: 1,
          originUserId: 1,
          timestamp: 1,
          destinationUserId: 1,
          hitRules: {
            $filter: {
              input: '$hitRules',
              as: 'rule',
              cond: {
                $and: [
                  { $eq: ['$$rule.isShadow', true] },
                  { $not: { $eq: ['$$rule.ruleHitMeta.hitDirections', null] } },
                ],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: '$hitRules',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            ruleInstanceId: '$hitRules.ruleInstanceId',
            time: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$timestamp',
                  },
                },
              },
            },
          },
          transactionIds: {
            $addToSet: '$transactionId',
          },
          originUserIds: {
            $addToSet: {
              $cond: [
                {
                  $in: ['ORIGIN', '$hitRules.ruleHitMeta.hitDirections'],
                },
                '$originUserId',
                null,
              ],
            },
          },
          destinationUserIds: {
            $addToSet: {
              $cond: [
                {
                  $in: ['DESTINATION', '$hitRules.ruleHitMeta.hitDirections'],
                },
                '$destinationUserId',
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          averageAlertsInvestigationTime,
        },
      },
      {
        $project: {
          ruleInstanceId: '$_id.ruleInstanceId',
          time: '$_id.time',
          transactionsCount: {
            $size: '$transactionIds',
          },
          userIds: {
            $filter: {
              input: {
                $setUnion: ['$originUserIds', '$destinationUserIds'],
              },
              as: 'userId',
              cond: {
                $ne: ['$$userId', null],
              },
            },
          },
          averageAlertsInvestigationTime: 1,
        },
      },
      {
        $merge: {
          into: shadowRuleAnalyticsCollectionName,
          on: ['ruleInstanceId', 'time'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const usersPipeline = [
      {
        $match: {
          ...timestampMatch,
          'hitRules.isShadow': true,
          'hitRules.ruleHitMeta.hitDirections': 'ORIGIN',
        },
      },
      {
        $project: {
          userId: 1,
          createdTimestamp: 1,
          hitRules: {
            $filter: {
              input: '$hitRules',
              as: 'rule',
              cond: {
                $and: [
                  { $eq: ['$$rule.isShadow', true] },
                  { $not: { $eq: ['$$rule.ruleHitMeta.hitDirections', null] } },
                ],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: '$hitRules',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            ruleInstanceId: '$hitRules.ruleInstanceId',
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
          },
          userIds: {
            $addToSet: '$userId',
          },
        },
      },
      {
        $addFields: {
          averageAlertsInvestigationTime,
        },
      },
      {
        $project: {
          ruleInstanceId: '$_id.ruleInstanceId',
          time: '$_id.time',
          userIds: 1,
          averageAlertsInvestigationTime: 1,
        },
      },
      {
        $merge: {
          into: shadowRuleAnalyticsCollectionName,
          on: ['ruleInstanceId', 'time'],
          whenMatched: 'merge',
          whenNotMatched: 'insert',
        },
      },
    ]

    const transactionsCollectionName = TRANSACTIONS_COLLECTION(tenantId)
    const transactionsCollection = db.collection<InternalTransaction>(
      transactionsCollectionName
    )
    const usersCollectionName = USERS_COLLECTION(tenantId)
    const usersCollection = db.collection<InternalUser>(usersCollectionName)

    await Promise.all([
      transactionsCollection.aggregate(transactionsPipeline).next(),
      usersCollection.aggregate(usersPipeline).next(),
    ])
  }

  public static async get(
    tenantId: string,
    ruleInstanceId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<ShadowRuleStats> {
    const db = await getMongoDbClientDb()
    const collection = db.collection(
      SHADOW_RULE_ANALYTICS_COLLECTION_HOURLY(tenantId)
    )

    let dateCondition: Record<string, unknown> | null = null
    if (startTimestamp != null || endTimestamp != null) {
      dateCondition = {}
      if (startTimestamp != null) {
        dateCondition['$gte'] =
          dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
      if (endTimestamp != null) {
        dateCondition['$lte'] = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
    }

    const pipeline = [
      {
        $match: {
          ruleInstanceId,
          ...(dateCondition ? { time: dateCondition } : {}),
        },
      },
      {
        $group: {
          _id: '$ruleInstanceId',
          transactionsCount: {
            $sum: '$transactionsCount',
          },
          userIds: {
            $push: '$userIds',
          },
          sumInvestigationTime: {
            $sum: '$averageAlertsInvestigationTime',
          },
          countInvestigationTime: {
            $sum: {
              $cond: {
                if: { $gt: ['$averageAlertsInvestigationTime', 0] },
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
          transactionsCount: true,
          usersCount: {
            $size: {
              $reduce: {
                input: '$userIds',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] },
              },
            },
          },
          avgInvestigationTime: {
            $cond: {
              if: { $gt: ['$countInvestigationTime', 0] },
              then: {
                $divide: ['$sumInvestigationTime', '$countInvestigationTime'],
              },
              else: 0,
            },
          },
        },
      },
    ]

    const result = await collection
      .aggregate<{
        transactionsCount: number
        usersCount: number
        avgInvestigationTime: number
      }>(pipeline)
      .next()

    const transactionsHit = result?.transactionsCount ?? 0
    const usersHit = result?.usersCount ?? 0
    const alertsHit = usersHit
    const investigationTime = (result?.avgInvestigationTime ?? 0) * usersHit

    return {
      transactionsHit,
      usersHit,
      alertsHit,
      investigationTime,
    }
  }
}
