import { Db, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import dayjs from 'dayjs'
import { DashboardTimeFrameType, TransactionDashboardStats } from '../constants'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DAY_DATE_FORMAT,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT,
  MONTH_DATE_FORMAT_JS,
  TRANSACTIONS_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_MONTHLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_DAILY,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { neverThrow } from '@/utils/lang'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

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

  private async recalculateHitsByUser(db: Db, tenantId: string) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(tenantId)
    )

    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
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

  private async recalculateRuleHitStats(db: Db, tenantId: string) {
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
      dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId),
        HOUR_DATE_FORMAT
      ),
      dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_MONTHLY(tenantId),
        MONTH_DATE_FORMAT
      ),
      dashboardRuleHitStatsHandler(
        tenantId,
        DASHBOARD_RULE_HIT_STATS_COLLECTION_DAILY(tenantId),
        DAY_DATE_FORMAT
      ),
    ])
  }

  public async recalculateTransactionsVolumeStats(db: Db, tenantId: string) {
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
    ])
  }

  public async refreshStats(tenantId: string) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db, tenantId),
      this.recalculateRuleHitStats(db, tenantId),
      this.recalculateHitsByUser(db, tenantId),
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
      startDateText = endDate.subtract(1, 'year').format(MONTH_DATE_FORMAT_JS)
      endDateText = endDate.format(MONTH_DATE_FORMAT_JS)
    } else if (timeframeType === 'WEEK') {
      startDateText = endDate.subtract(1, 'week').format(DAY_DATE_FORMAT_JS)
      endDateText = endDate.format(DAY_DATE_FORMAT_JS)
    } else if (timeframeType === 'MONTH') {
      startDateText = endDate.subtract(1, 'month').format(DAY_DATE_FORMAT_JS)
      endDateText = endDate.format(DAY_DATE_FORMAT_JS)
    } else if (timeframeType === 'DAY') {
      startDateText = endDate.subtract(1, 'day').format(HOUR_DATE_FORMAT_JS)
      endDateText = endDate.format(HOUR_DATE_FORMAT_JS)
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

  public async getHitsByUserStats(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<
    {
      originUserId: string
      user: InternalConsumerUser | InternalBusinessUser | null
      rulesHit: number
    }[]
  > {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionDashboardStats>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
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
          $limit: 10,
        },
        {
          $sort: { rulesHit: -1 },
        },
        {
          $lookup: {
            from: USERS_COLLECTION(tenantId),
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
}
