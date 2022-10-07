import { Db, MongoClient } from 'mongodb'
import _ from 'lodash'
import { getAffectedInterval, getTimeLabels } from '../utils'
import dayjs from '@/utils/dayjs'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { DashboardStatsRulesCountData } from '@/@types/openapi-internal/DashboardStatsRulesCountData'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { RuleAction } from '@/@types/openapi-public/RuleAction'

export type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY'
const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' }

const TRANSACTION_STATE_KEY_TO_RULE_ACTION: Map<
  keyof DashboardStatsTransactionsCountData,
  RuleAction
> = new Map([
  ['flaggedTransactions', 'FLAG'],
  ['stoppedTransactions', 'BLOCK'],
  ['suspendedTransactions', 'SUSPEND'],
])

export class DashboardStatsRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  private async recalculateHitsByUser(
    db: Db,
    direction: 'ORIGIN' | 'DESTINATION',
    timestamp?: number
  ) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const userFieldName =
      direction === 'DESTINATION' ? 'destinationUserId' : 'originUserId'

    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)

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

    let timestampMatch = undefined
    if (timestamp) {
      const { start, end } = getAffectedInterval(timestamp, 'HOUR')
      timestampMatch = {
        timestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    await transactionsCollection
      .aggregate([
        {
          $match: {
            ...timestampMatch,
            [userFieldName]: { $exists: true },
          },
        },
        {
          $project: {
            [userFieldName]: true,
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: { $toDate: { $toLong: '$timestamp' } },
              },
            },
            rulesHit: {
              $filter: {
                input: '$executedRules',
                as: 'rule',
                cond: { $eq: ['$$rule.ruleHit', true] },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              date: '$date',
              userId: `$${userFieldName}`,
            },
            rulesHit: { $sum: { $size: '$rulesHit' } },
            transactionsHit: {
              $sum: {
                $switch: {
                  branches: [
                    {
                      case: { $gt: [{ $size: '$rulesHit' }, 0] },
                      then: 1,
                    },
                  ],
                  default: 0,
                },
              },
            },
          },
        },
        {
          $project: {
            _id: false,
            date: '$_id.date',
            userId: '$_id.userId',
            direction: direction,
            rulesHit: '$rulesHit',
            transactionsHit: '$transactionsHit',
          },
        },
        {
          $merge: {
            into: aggregationCollection,
            on: ['direction', 'date', 'userId'],
            whenMatched: 'merge',
          },
        },
      ])
      .next()
  }

  private async recalculateRuleHitStats(db: Db, timestamp?: number) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregationCollection = DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(
      this.tenantId
    )
    let timestampMatch = undefined
    if (timestamp) {
      const { start, end } = getAffectedInterval(timestamp, 'HOUR')
      timestampMatch = {
        timestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    await transactionsCollection
      .aggregate([
        { $match: { ...timestampMatch } },
        {
          $unwind: {
            path: '$hitRules',
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
                      $toLong: '$timestamp',
                    },
                  },
                },
              },
              ruleId: '$hitRules.ruleId',
              ruleInstanceId: '$hitRules.ruleInstanceId',
            },
            hitCount: {
              $sum: 1,
            },
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
              },
            },
          },
        },
        {
          $merge: {
            into: aggregationCollection,
            whenMatched: 'merge',
            whenNotMatched: 'insert',
          },
        },
      ])
      .next()
  }

  public async recalculateTransactionsVolumeStats(db: Db, timestamp?: number) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(this.tenantId)
    const aggregatedDailyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(this.tenantId)
    const aggregatedMonthlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(this.tenantId)

    const getHourlyAggregationPipeline = (
      key: keyof DashboardStatsTransactionsCountData
    ) => {
      // Stages for calculating rules final action, which follows the same
      // logic as TransactionRepository.getAggregatedRuleStatus
      const rulesResultPipeline = [
        {
          $addFields: {
            hitRulesResult: {
              $map: {
                input: '$hitRules',
                as: 'rule',
                in: {
                  ruleAction: '$$rule.ruleAction',
                  order: {
                    $indexOfArray: [RULE_ACTIONS, '$$rule.ruleAction'],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            hitRulesResult: {
              $reduce: {
                input: '$hitRulesResult',
                initialValue: null,
                in: {
                  $cond: {
                    if: {
                      $or: [
                        { $eq: ['$$value', null] },
                        { $lt: ['$$this.order', '$$value.order'] },
                      ],
                    },
                    then: '$$this',
                    else: '$$value',
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            hitRulesResult: {
              $cond: {
                if: { $eq: ['$hitRulesResult', null] },
                then: 'null',
                else: '$hitRulesResult.ruleAction',
              },
            },
          },
        },
      ]
      const ruleAction = TRANSACTION_STATE_KEY_TO_RULE_ACTION.get(key)
      const ruleActionMatch = ruleAction && { hitRulesResult: ruleAction }
      let timestampMatch = undefined
      if (timestamp) {
        const { start, end } = getAffectedInterval(timestamp, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return [
        ...(ruleAction ? rulesResultPipeline : []),
        { $match: { ...timestampMatch, ...ruleActionMatch } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: { $toDate: { $toLong: '$timestamp' } },
              },
            },
            [key]: { $sum: 1 },
          },
        },
        {
          $merge: {
            into: aggregatedHourlyCollectionName,
            whenMatched: 'merge',
          },
        },
      ]
    }

    // Hourly Stats
    await transactionsCollection
      .aggregate(getHourlyAggregationPipeline('totalTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHourlyAggregationPipeline('flaggedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHourlyAggregationPipeline('stoppedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHourlyAggregationPipeline('suspendedTransactions'))
      .next()

    const getDerivedAggregationPipeline = (
      granularity: 'DAY' | 'MONTH',
      timestamp?: number
    ) => {
      let timestampMatch = undefined
      if (timestamp) {
        const { start, end } = getAffectedInterval(timestamp, granularity)
        const format =
          granularity === 'DAY' ? HOUR_DATE_FORMAT_JS : DAY_DATE_FORMAT_JS
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
          },
        },
        {
          $group: {
            _id: '$time',
            totalTransactions: {
              $sum: '$totalTransactions',
            },
            flaggedTransactions: {
              $sum: '$flaggedTransactions',
            },
            stoppedTransactions: {
              $sum: '$stoppedTransactions',
            },
            suspendedTransactions: {
              $sum: '$suspendedTransactions',
            },
          },
        },
        {
          $merge: {
            into:
              granularity === 'DAY'
                ? aggregatedDailyCollectionName
                : aggregatedMonthlyCollectionName,
            whenMatched: 'replace',
          },
        },
      ]
    }

    // Daily stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedHourlyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('DAY', timestamp))
      .next()

    // Monthly stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedDailyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('MONTH', timestamp))
      .next()
  }

  public async refreshStats(timestamp?: number) {
    const db = this.mongoDb.db()

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db, timestamp),
      this.recalculateRuleHitStats(db, timestamp),
      this.recalculateHitsByUser(db, 'ORIGIN', timestamp),
      this.recalculateHitsByUser(db, 'DESTINATION', timestamp),
    ])
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsTransactionsCountData[]> {
    const tenantId = this.tenantId
    const db = this.mongoDb.db()

    let collection
    let timeLabels: string[]
    let timeFormat: string

    if (granularity === granularityValues.DAY) {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
      )
      timeLabels = getTimeLabels(
        DAY_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'DAY'
      )
      timeFormat = DAY_DATE_FORMAT_JS
    } else if (granularity === granularityValues.MONTH) {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)
      )
      timeLabels = getTimeLabels(
        MONTH_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'MONTH'
      )
      timeFormat = MONTH_DATE_FORMAT_JS
    } else {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
      )
      timeLabels = getTimeLabels(
        HOUR_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'HOUR'
      )
      timeFormat = HOUR_DATE_FORMAT_JS
    }

    const startDate = dayjs(startTimestamp).format(timeFormat)
    const endDate = dayjs(endTimestamp).format(timeFormat)

    const dashboardStats = await collection
      .find({
        _id: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ _id: 1 })
      .toArray()

    const dashboardStatsById = _.keyBy(dashboardStats, '_id')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        _id: timeLabel,
        totalTransactions: stat?.totalTransactions ?? 0,
        flaggedTransactions: stat?.flaggedTransactions ?? 0,
        stoppedTransactions: stat?.stoppedTransactions ?? 0,
        suspendedTransactions: stat?.suspendedTransactions ?? 0,
      }
    })
  }

  public async getHitsByUserStats(
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION'
  ): Promise<
    {
      userId: string
      user: InternalConsumerUser | InternalBusinessUser | null
      transactionsHit: number
      rulesHit: number
    }[]
  > {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
    )

    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: string
        transactionsHit: number
        rulesHit: number
        user: InternalConsumerUser | InternalBusinessUser | null
      }>([
        {
          $match: {
            ...(direction ? { direction } : {}),
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: `$userId`,
            transactionsHit: { $sum: '$transactionsHit' },
            rulesHit: { $sum: '$rulesHit' },
          },
        },
        {
          $sort: { transactionsHit: -1 },
        },
        {
          $limit: 10,
        },
        {
          $match: {
            transactionsHit: {
              $gte: 1,
            },
          },
        },
        {
          $lookup: {
            from: USERS_COLLECTION(this.tenantId),
            localField: '_id',
            foreignField: 'userId',
            as: 'user',
          },
        },
        {
          $set: {
            user: { $first: '$user' },
          },
        },
      ])
      .toArray()

    return result.map((x) => ({
      userId: x._id,
      user: x.user ?? null,
      transactionsHit: x.transactionsHit,
      rulesHit: x.rulesHit,
    }))
  }

  public async getRuleHitCountStats(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsRulesCountData[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
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
      }>([
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
          },
        },
        { $sort: { hitCount: -1 } },
      ])
      .toArray()

    return result.map((x) => ({
      ruleId: x._id.ruleId,
      ruleInstanceId: x._id.ruleInstanceId,
      hitCount: x.hitCount,
    }))
  }
}
