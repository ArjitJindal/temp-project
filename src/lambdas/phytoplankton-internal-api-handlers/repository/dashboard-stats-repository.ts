import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import dayjs from 'dayjs'
import { DashboardTimeFrameType, TransactionDashboardStats } from '../constants'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DAY_DATE_FORMAT,
  HOUR_DATE_FORMAT,
  MONTH_DATE_FORMAT,
  TRANSACTIONS_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_MONTHLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_DAILY,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { neverThrow } from '@/utils/lang'

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

  public async refreshStats(tenantId: string) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)

    const dashboardTransactionStatsHandler = async (
      aggregatedCollectionName: string,
      dateIdFormat: string
    ) => {
      const transactionsCollection = db.collection<TransactionCaseManagement>(
        TRANSACTIONS_COLLECTION(tenantId)
      )
      try {
        await transactionsCollection
          .aggregate([
            { $match: { timestamp: { $gte: 0 } } }, // aggregates everything for now
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: dateIdFormat,
                    date: { $toDate: { $toLong: '$timestamp' } },
                  },
                },
                totalTransactions: { $sum: 1 },
              },
            },
            {
              $merge: {
                into: aggregatedCollectionName,
                whenMatched: 'replace',
              },
            },
          ])
          .next()
        await transactionsCollection
          .aggregate([
            {
              $match: {
                timestamp: { $gte: 0 },
                executedRules: {
                  $elemMatch: {
                    ruleAction: 'FLAG',
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: dateIdFormat,
                    date: { $toDate: { $toLong: '$timestamp' } },
                  },
                },
                flaggedTransactions: { $sum: 1 },
              },
            },
            {
              $merge: {
                into: aggregatedCollectionName,
                whenMatched: 'merge',
              },
            },
          ])
          .next()
        await transactionsCollection
          .aggregate([
            {
              $match: {
                timestamp: { $gte: 0 },
                executedRules: {
                  $elemMatch: {
                    ruleAction: 'BLOCK',
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: dateIdFormat,
                    date: { $toDate: { $toLong: '$timestamp' } },
                  },
                },
                stoppedTransactions: { $sum: 1 },
              },
            },
            {
              $merge: {
                into: aggregatedCollectionName,
                whenMatched: 'merge',
              },
            },
          ])
          .next()
      } catch (e) {
        console.error(`ERROR ${e}`)
      }
    }

    const dashboardRuleHitStatsHandler = async (
      tenantId: string,
      aggregatedCollectionName: string,
      dateIdFormat: string
    ) => {
      const transactionsCollection = db.collection<TransactionCaseManagement>(
        TRANSACTIONS_COLLECTION(tenantId)
      )
      try {
        await transactionsCollection
          .aggregate([
            {
              $project: {
                timestamp: '$timestamp',
                executedRules: {
                  $filter: {
                    input: '$executedRules',
                    as: 'rule',
                    cond: {
                      $eq: ['$$rule.ruleHit', true],
                    },
                  },
                },
              },
            },
            {
              $unwind: {
                path: '$executedRules',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $group: {
                _id: {
                  time: {
                    $dateToString: {
                      format: dateIdFormat,
                      date: {
                        $toDate: {
                          $toLong: '$timestamp',
                        },
                      },
                    },
                  },
                  ruleId: '$executedRules.ruleId',
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
                into: aggregatedCollectionName,
                whenMatched: 'replace',
              },
            },
          ])
          .next()
      } catch (e) {
        console.error(`ERROR ${e}`)
      }
    }

    await Promise.all([
      dashboardTransactionStatsHandler(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId),
        MONTH_DATE_FORMAT
      ),
      dashboardTransactionStatsHandler(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId),
        DAY_DATE_FORMAT
      ),
      dashboardTransactionStatsHandler(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId),
        HOUR_DATE_FORMAT
      ),
      await dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId),
        HOUR_DATE_FORMAT
      ),
      await dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_MONTHLY(tenantId),
        MONTH_DATE_FORMAT
      ),
      await dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_DAILY(tenantId),
        DAY_DATE_FORMAT
      ),
    ])
  }

  public async getTransactionCountStats(
    timeframeType: DashboardTimeFrameType,
    endTimestamp: number
  ): Promise<TransactionDashboardStats[]> {
    const tenantId = this.tenantId
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)

    let collectionName: string
    if (timeframeType === 'YEAR') {
      collectionName = DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)
    } else if (timeframeType === 'WEEK' || timeframeType === 'MONTH') {
      collectionName = DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
    } else if (timeframeType === 'DAY') {
      collectionName = DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    } else {
      throw neverThrow(timeframeType, `Unsupported timeframe: ${timeframeType}`)
    }
    const collection = db.collection<TransactionDashboardStats>(collectionName)

    const endDate = dayjs(endTimestamp)
    let endDateText: string
    let startDateText: string
    if (timeframeType === 'YEAR') {
      startDateText = endDate.subtract(1, 'year').format('YYYY-MM')
      endDateText = endDate.format('YYYY-MM')
    } else if (timeframeType === 'WEEK') {
      startDateText = endDate.subtract(1, 'week').format('YYYY-MM-DD')
      endDateText = endDate.format('YYYY-MM-DD')
    } else if (timeframeType === 'MONTH') {
      startDateText = endDate.subtract(1, 'month').format('YYYY-MM-DD')
      endDateText = endDate.format('YYYY-MM-DD')
    } else if (timeframeType === 'DAY') {
      startDateText = endDate.subtract(1, 'day').format('YYYY-MM-DD[T]HH')
      endDateText = endDate.format('YYYY-MM-DD[T]HH')
    } else {
      throw neverThrow(
        timeframeType,
        `Unsupported timeframe type: ${timeframeType}`
      )
    }

    return await collection
      .find({
        _id: {
          $gt: startDateText,
          $lte: endDateText,
        },
      })
      .sort({ _id: -1 })
      .toArray()
  }
}
