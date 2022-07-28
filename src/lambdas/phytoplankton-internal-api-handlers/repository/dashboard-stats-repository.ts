import { Db, MongoClient } from 'mongodb'
import { RuleDashboardStats, TransactionDashboardStats } from '../constants'
import dayjs from '@/utils/dayjs'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DAY_DATE_FORMAT,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'

export type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY'
const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' }

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

  private async recalculateHitsByUser(db: Db) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
    await db.createIndex(
      aggregationCollection,
      {
        date: -1,
        originUserId: -1,
      },
      {
        unique: true,
      }
    )
    await transactionsCollection
      .aggregate([
        {
          $match: {
            originUserId: { $exists: true },
          },
        },
        {
          $project: {
            originUserId: true,
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
              originUserId: '$originUserId',
            },
            rulesHit: { $sum: { $size: '$rulesHit' } },
          },
        },
        {
          $project: {
            _id: false,
            date: '$_id.date',
            originUserId: '$_id.originUserId',
            rulesHit: '$rulesHit',
          },
        },
        {
          $merge: {
            into: aggregationCollection,
            on: ['date', 'originUserId'],
            whenMatched: 'merge',
          },
        },
      ])
      .next()
  }

  private async recalculateRuleHitStats(db: Db) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregationCollection = DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(
      this.tenantId
    )
    await transactionsCollection
      .aggregate([
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

  public async recalculateTransactionsVolumeStats(db: Db) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(this.tenantId)
    const aggregatedDailyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(this.tenantId)
    const aggregatedMonthlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(this.tenantId)

    // Stages for calculating rules final action, which follows the same
    // logic as TransactionRepository.getAggregatedRuleStatus
    const rulesResultStages = [
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
    // Hourly Stats
    try {
      await transactionsCollection
        .aggregate([
          { $match: { timestamp: { $gte: 0 } } }, // aggregates everything for now
          {
            $group: {
              _id: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              totalTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'replace',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'FLAG',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              flaggedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'BLOCK',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              stoppedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'SUSPEND',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              suspendedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
    } catch (e) {
      console.error(`ERROR ${e}`)
    }
    // Daily stats
    try {
      await transactionsCollection
        .aggregate([
          { $match: { timestamp: { $gte: 0 } } }, // aggregates everything for now
          {
            $group: {
              _id: {
                $dateToString: {
                  format: DAY_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              totalTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedDailyCollectionName,
              whenMatched: 'replace',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'FLAG',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: DAY_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              flaggedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedDailyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'BLOCK',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: DAY_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              stoppedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedDailyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'SUSPEND',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: DAY_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              suspendedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedDailyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
    } catch (e) {
      console.error(`ERROR ${e}`)
    }
    // Monthly stats
    try {
      await transactionsCollection
        .aggregate([
          { $match: { timestamp: { $gte: 0 } } }, // aggregates everything for now
          {
            $group: {
              _id: {
                $dateToString: {
                  format: MONTH_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              totalTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedMonthlyCollectionName,
              whenMatched: 'replace',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'FLAG',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: MONTH_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              flaggedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedMonthlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'BLOCK',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: MONTH_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              stoppedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedMonthlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
      await transactionsCollection
        .aggregate([
          ...rulesResultStages,
          {
            $match: {
              timestamp: { $gte: 0 },
              hitRulesResult: 'SUSPEND',
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: MONTH_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
              suspendedTransactions: { $sum: 1 },
            },
          },
          {
            $merge: {
              into: aggregatedMonthlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ])
        .next()
    } catch (e) {
      console.error(`ERROR ${e}`)
    }
  }

  public async refreshStats() {
    const db = this.mongoDb.db()

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db),
      this.recalculateRuleHitStats(db),
      this.recalculateHitsByUser(db),
    ])
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<TransactionDashboardStats[]> {
    const tenantId = this.tenantId
    const db = this.mongoDb.db()

    let collection

    if (granularity === granularityValues.DAY) {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
      )
    } else if (granularity === granularityValues.MONTH) {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)
      )
    } else {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
      )
    }

    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    return await collection
      .find({
        _id: {
          $gt: startDate,
          $lte: endDate,
        },
      })
      .sort({ _id: 1 })
      .toArray()
  }

  public async getHitsByUserStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<
    {
      originUserId: string
      user: InternalConsumerUser | InternalBusinessUser | null
      rulesHit: number
    }[]
  > {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionDashboardStats>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
    )

    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: string
        rulesHit: number
        user: InternalConsumerUser | InternalBusinessUser | null
      }>([
        {
          $match: {
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: '$originUserId',
            rulesHit: { $sum: '$rulesHit' },
          },
        },
        {
          $sort: { rulesHit: -1 },
        },
        {
          $limit: 10,
        },
        {
          $match: {
            rulesHit: {
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
      originUserId: x._id,
      user: x.user ?? null,
      rulesHit: x.rulesHit,
    }))
  }

  public async getRuleHitCountStats(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<RuleDashboardStats[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionDashboardStats>(
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: string
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
            _id: '$rulesStats.ruleId',
            hitCount: { $sum: '$rulesStats.hitCount' },
          },
        },
        { $sort: { hitCount: -1 } },
      ])
      .toArray()

    return result.map((x) => ({
      ruleId: x._id,
      hitCount: x.hitCount,
    }))
  }
}
