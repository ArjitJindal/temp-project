import { Db, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import dayjs from 'dayjs'
import { RuleDashboardStats, TransactionDashboardStats } from '../constants'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  TRANSACTIONS_COLLECTION,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
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

  private async recalculateRuleHitStats(db: Db, tenantId: string) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregationCollection =
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
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

  public async recalculateTransactionsVolumeStats(db: Db, tenantId: string) {
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregatedCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
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
              hitRules: {
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
                  format: HOUR_DATE_FORMAT,
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
              hitRules: {
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
                  format: HOUR_DATE_FORMAT,
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

  public async refreshStats(tenantId: string) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db, tenantId),
      this.recalculateRuleHitStats(db, tenantId),
      this.recalculateHitsByUser(db, tenantId),
    ])
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<TransactionDashboardStats[]> {
    const tenantId = this.tenantId
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)

    const collection = db.collection<TransactionDashboardStats>(
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    )

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

  public async getRuleHitCountStats(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<RuleDashboardStats[]> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
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
