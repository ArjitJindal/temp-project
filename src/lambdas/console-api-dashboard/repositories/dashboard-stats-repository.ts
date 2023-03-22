import { Db, MongoClient, WithId } from 'mongodb'
import _ from 'lodash'
import { getAffectedInterval, getTimeLabels } from '../utils'
import { DashboardStatsDRSDistributionData } from './types'
import dayjs from '@/utils/dayjs'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
  DRS_SCORES_COLLECTION,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { DashboardStatsRulesCountData } from '@/@types/openapi-internal/DashboardStatsRulesCountData'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { logger } from '@/core/logger'
import { Case } from '@/@types/openapi-internal/Case'

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

const CASE_GROUP_KEYS = {
  openUserCaseIds: {
    $addToSet: {
      $cond: {
        if: {
          $ne: ['$caseStatus', 'CLOSED'],
        },
        then: '$caseId',
        else: '$$REMOVE',
      },
    },
  },
  userCaseIds: {
    $addToSet: '$caseId',
  },
}

const CASE_PROJECT_KEYS = {
  openTransactionCasesCount: {
    $size: { $ifNull: ['$openTransactionCaseIds', []] },
  },
  openUserCasesCount: {
    $size: { $ifNull: ['$openUserCaseIds', []] },
  },
  transactionCasesCount: {
    $size: { $ifNull: ['$transactionCaseIds', []] },
  },
  userCasesCount: {
    $size: { $ifNull: ['$userCaseIds', []] },
  },
}

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

  public async recalculateHitsByUser(
    direction: 'ORIGIN' | 'DESTINATION',
    timestamp?: number
  ) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const userFieldName =
      direction === 'ORIGIN'
        ? 'caseUsers.origin.userId'
        : 'caseUsers.destination.userId'
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
    await casesCollection.aggregate(pipeline).next()
  }

  public async recalculateRuleHitStats(timestamp?: number) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const aggregationCollection = DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(
      this.tenantId
    )
    let timestampMatch = undefined
    if (timestamp) {
      const { start, end } = getAffectedInterval(timestamp, 'HOUR')
      timestampMatch = {
        createdTimestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      { $match: { ...timestampMatch } },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $unwind: {
          path: '$caseTransactions.hitRules',
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
            ruleId: '$caseTransactions.hitRules.ruleId',
            ruleInstanceId: '$caseTransactions.hitRules.ruleInstanceId',
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
    await casesCollection.aggregate(pipeline).next()
  }

  private sanitizeBucketBoundry(riskIntervalBoundries: Array<number>) {
    if (!riskIntervalBoundries) {
      return []
    }
    const legitIntervalBoundry = [riskIntervalBoundries[0]]
    for (let i = 1; i < riskIntervalBoundries.length; i++) {
      if (riskIntervalBoundries[i] === riskIntervalBoundries[i - 1]) {
        legitIntervalBoundry.push(riskIntervalBoundries[i] + 0.01)
      } else if (riskIntervalBoundries[i] < riskIntervalBoundries[i - 1]) {
        legitIntervalBoundry.push(riskIntervalBoundries[i - 1] + 0.01)
      } else {
        legitIntervalBoundry.push(riskIntervalBoundries[i])
      }
    }
    return legitIntervalBoundry
  }

  private async recalculateDRSDistributionStats(db: Db) {
    const drsScoresCollection = db.collection<InternalTransaction>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )
    const aggregationCollection = DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(
      this.tenantId
    )
    const dynamoDb = getDynamoDbClient()

    const riskRepository = new RiskRepository(this.tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const riskIntervalBoundries = riskClassificationValues.map(
      (classificationValue: RiskClassificationScore) =>
        classificationValue.lowerBoundRiskScore
    )
    riskIntervalBoundries.push(
      riskClassificationValues[riskClassificationValues.length - 1]
        .upperBoundRiskScore
    )
    // We need to sanitize the boundry - it must be strictly increasing. Limited info from mongo on the error code 40194
    // You can view the error log here: https://github.com/bwaldvogel/mongo-java-server/blob/main/test-common/src/main/java/de/bwaldvogel/mongo/backend/AbstractAggregationTest.java
    const sanitizedBounries = this.sanitizeBucketBoundry(riskIntervalBoundries)
    await drsScoresCollection
      .aggregate([
        { $sort: { createdAt: -1, userId: 1 } },
        { $group: { _id: '$userId', drsScore: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$drsScore' } },
        {
          $bucket: {
            groupBy: '$drsScore',
            boundaries: sanitizedBounries,
            default: sanitizedBounries[sanitizedBounries.length - 1],
            output: {
              count: { $sum: 1 },
            },
          },
        },
        {
          $merge: {
            into: aggregationCollection,
            whenMatched: 'merge',
          },
        },
      ])
      .next()

    logger.info(`Aggregation done`)
  }

  public async recalculateTransactionsVolumeStats(db: Db, timestamp?: number) {
    const transactionsCollection = db.collection<InternalTransaction>(
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
            whenMatched: 'merge',
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

  public async refreshAllStats() {
    await Promise.all([
      this.refreshTransactionStats(),
      this.refreshCaseStats(),
      this.refreshUserStats(),
    ])
  }

  public async refreshTransactionStats(transactionTimestamp?: number) {
    const db = this.mongoDb.db()

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db, transactionTimestamp),
    ])
  }

  public async refreshCaseStats(caseTimestamp?: number) {
    await Promise.all([
      this.recalculateRuleHitStats(caseTimestamp),
      this.recalculateHitsByUser('ORIGIN', caseTimestamp),
      this.recalculateHitsByUser('DESTINATION', caseTimestamp),
    ])
  }

  public async refreshUserStats() {
    const db = this.mongoDb.db()
    await this.recalculateDRSDistributionStats(db)
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
      transactionCasesCount: number
      userCasesCount: number
      openTransactionCasesCount: number
      openUserCasesCount: number
    }[]
  > {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
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

    const totalTransactions = await collection
      .aggregate<{
        _id: null
        totalTransactions: number
      }>([
        condition,
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: '$transactionsHit' },
          },
        },
      ])
      .next()
      .then((result) => result?.totalTransactions ?? 0)

    const result = await collection
      .aggregate<{
        _id: string
        transactionsHit: number
        rulesHit: number
        user: InternalConsumerUser | InternalBusinessUser | null
        transactionCasesCount: number
        userCasesCount: number
        openTransactionCasesCount: number
        openUserCasesCount: number
      }>([
        condition,
        {
          $group: {
            _id: `$userId`,
            transactionsHit: { $sum: '$transactionsHit' },
            rulesHit: { $sum: '$rulesHit' },
            transactionCasesCount: { $sum: '$transactionCasesCount' },
            userCasesCount: { $sum: '$userCasesCount' },
            openTransactionCasesCount: { $sum: '$openTransactionCasesCount' },
            openUserCasesCount: { $sum: '$openUserCasesCount' },
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
      transactionCasesCount: x.transactionCasesCount,
      userCasesCount: x.userCasesCount,
      openTransactionCasesCount: x.openTransactionCasesCount,
      openUserCasesCount: x.openUserCasesCount,
      percentageTransactionsHit: _.round(
        (x.transactionsHit / totalTransactions) * 100,
        2
      ),
    }))
  }
  private createDistributionItems(
    riskClassificationValues: RiskClassificationScore[],
    buckets: WithId<DashboardStatsTransactionsCountData>[]
  ) {
    let total = 0
    buckets.map((bucket: any) => {
      total += bucket.count
    })
    const result: any = []
    buckets.map((bucket: any) => {
      riskClassificationValues.map(
        (classificationValue: RiskClassificationScore) => {
          if (bucket._id === classificationValue.lowerBoundRiskScore) {
            result.push({
              riskLevel: classificationValue.riskLevel,
              count: bucket.count,
              percentage: ((100 * bucket.count) / total).toFixed(2),
              riskScoreRange: `${classificationValue.lowerBoundRiskScore} - ${classificationValue.upperBoundRiskScore}`,
            })
          }
        }
      )
    })
    return result
  }

  public async getDRSDistributionStats(): Promise<any> {
    const db = this.mongoDb.db()

    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(this.tenantId)
    )

    const dynamoDb = getDynamoDbClient()

    const riskRepository = new RiskRepository(this.tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const result = await collection.find({}).toArray()

    const distributionItems = this.createDistributionItems(
      riskClassificationValues,
      result
    )

    return distributionItems
  }

  public async getRuleHitCountStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsRulesCountData[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsDRSDistributionData>(
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(this.tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: { ruleId: string; ruleInstanceId: string }
        hitCount: number
        transactionCasesCount: number
        userCasesCount: number
        openTransactionCasesCount: number
        openUserCasesCount: number
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
            transactionCasesCount: {
              $sum: '$rulesStats.transactionCasesCount',
            },
            userCasesCount: { $sum: '$rulesStats.userCasesCount' },
            openTransactionCasesCount: {
              $sum: '$rulesStats.openTransactionCasesCount',
            },
            openUserCasesCount: { $sum: '$rulesStats.openUserCasesCount' },
          },
        },
        { $sort: { hitCount: -1 } },
      ])
      .toArray()

    return result.map((x) => ({
      ruleId: x._id.ruleId,
      ruleInstanceId: x._id.ruleInstanceId,
      hitCount: x.hitCount,
      transactionCasesCount: x.transactionCasesCount,
      userCasesCount: x.userCasesCount,
      openTransactionCasesCount: x.openTransactionCasesCount,
      openUserCasesCount: x.openUserCasesCount,
    }))
  }
}
