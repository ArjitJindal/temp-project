import { keyBy } from 'lodash'
import { getAffectedInterval, getTimeLabels } from '../../utils'
import { GranularityValuesType, TimeRange } from '../types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import {
  RISK_LEVELS,
  TRANSACTION_TYPES,
} from '@/@types/openapi-internal-custom/all'

const TRANSACTION_STATE_KEY_TO_RULE_ACTION: Map<
  keyof DashboardStatsTransactionsCountData,
  RuleAction
> = new Map([
  ['flaggedTransactions', 'FLAG'],
  ['stoppedTransactions', 'BLOCK'],
  ['suspendedTransactions', 'SUSPEND'],
])

export class TransactionStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const lastUpdatedAt = Date.now()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    const aggregatedDailyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
    const aggregatedMonthlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)

    const getHitRulesAggregationPipeline = (
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
      let timestampMatch: any = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return withUpdatedAt(
        [
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
        ],
        lastUpdatedAt
      )
    }

    const getPaymentMethodAggregationPipeline = () => {
      let timestampMatch: any = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return withUpdatedAt(
        [
          ...(timestampMatch ? [{ $match: timestampMatch }] : []),
          {
            $addFields: {
              paymentMethods: [
                '$originPaymentDetails.method',
                '$destinationPaymentDetails.method',
              ],
            },
          },
          {
            $unwind: {
              path: '$paymentMethods',
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              paymentMethods: {
                $ne: null,
              },
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
                method: {
                  $concat: ['paymentMethods_', '$paymentMethods'],
                },
              },
              count: {
                $count: {},
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              items: {
                $addToSet: {
                  k: '$_id.method',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              items: {
                $arrayToObject: '$items',
              },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  {
                    _id: '$_id',
                  },
                  '$items',
                ],
              },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ],
        lastUpdatedAt
      )
    }

    const getTRSAggregationPipeline = (
      dateFormat: string,
      aggregationCollection: string
    ) => {
      let timestampMatch: Record<string, unknown> | undefined = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return withUpdatedAt(
        [
          {
            $match: {
              ...timestampMatch,
              'arsScore.riskLevel': {
                $ne: null,
              },
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: dateFormat,
                    date: {
                      $toDate: {
                        $toLong: '$timestamp',
                      },
                    },
                  },
                },
                riskScore: {
                  $concat: ['arsRiskLevel_', '$arsScore.riskLevel'],
                },
              },
              count: {
                $count: {},
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              items: {
                $addToSet: {
                  k: '$_id.riskScore',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              items: {
                $arrayToObject: '$items',
              },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  {
                    _id: '$_id',
                  },
                  '$items',
                ],
              },
            },
          },
          {
            $merge: {
              into: aggregationCollection,
              whenMatched: 'merge',
            },
          },
        ],
        lastUpdatedAt
      )
    }

    const getTransactionTypeAggregationPipeline = () => {
      let timestampMatch: any = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return withUpdatedAt(
        [
          ...(timestampMatch ? [{ $match: timestampMatch }] : []),
          {
            $match: {
              type: {
                $ne: null,
              },
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
                type: {
                  $concat: ['transactionType_', '$type'],
                },
              },
              count: {
                $count: {},
              },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              items: {
                $addToSet: {
                  k: '$_id.type',
                  v: '$count',
                },
              },
            },
          },
          {
            $project: {
              items: {
                $arrayToObject: '$items',
              },
            },
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  {
                    _id: '$_id',
                  },
                  '$items',
                ],
              },
            },
          },
          {
            $merge: {
              into: aggregatedHourlyCollectionName,
              whenMatched: 'merge',
            },
          },
        ],
        lastUpdatedAt
      )
    }

    // Hourly Stats
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('totalTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('flaggedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('stoppedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('suspendedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getPaymentMethodAggregationPipeline())
      .next()
    await transactionsCollection
      .aggregate(getTransactionTypeAggregationPipeline())
      .next()
    await transactionsCollection
      .aggregate(
        getTRSAggregationPipeline(
          HOUR_DATE_FORMAT,
          aggregatedHourlyCollectionName
        )
      )
      .next()

    const getDerivedAggregationPipeline = (
      granularity: 'DAY' | 'MONTH',
      timeRange?: TimeRange
    ) => {
      let timestampMatch: any = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, granularity)
        const format =
          granularity === 'DAY' ? HOUR_DATE_FORMAT_JS : DAY_DATE_FORMAT_JS
        timestampMatch = {
          _id: {
            $gte: dayjs(start).format(format),
            $lt: dayjs(end).format(format),
          },
        }
      }
      return withUpdatedAt(
        [
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
              ...PAYMENT_METHODS.reduce(
                (acc, x) => ({
                  ...acc,
                  [`paymentMethods_${x}`]: {
                    $sum: `$paymentMethods_${x}`,
                  },
                }),
                {}
              ),
              ...RISK_LEVELS.reduce(
                (acc, x) => ({
                  ...acc,
                  [`arsRiskLevel_${x}`]: {
                    $sum: `$arsRiskLevel_${x}`,
                  },
                }),
                {}
              ),
              ...TRANSACTION_TYPES.reduce(
                (acc, type) => ({
                  ...acc,
                  [`transactionType_${type}`]: {
                    $sum: `$transactionType_${type}`,
                  },
                }),
                {}
              ),
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
        ],
        lastUpdatedAt
      )
    }

    // Daily stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedHourlyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('DAY', timeRange))
      .next()

    // Monthly stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedDailyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('MONTH', timeRange))
      .next()

    await Promise.all([
      cleanUpStaleData(
        aggregatedHourlyCollectionName,
        '_id',
        lastUpdatedAt,
        timeRange,
        'HOUR'
      ),
      cleanUpStaleData(
        aggregatedDailyCollectionName,
        '_id',
        lastUpdatedAt,
        timeRange,
        'DAY'
      ),
      cleanUpStaleData(
        aggregatedMonthlyCollectionName,
        '_id',
        lastUpdatedAt,
        timeRange,
        'MONTH'
      ),
    ])
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsTransactionsCountData[]> {
    const db = await getMongoDbClientDb()
    let collection
    let timeLabels: string[]
    let timeFormat: string

    if (granularity === 'DAY') {
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
    } else if (granularity === 'MONTH') {
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
      .allowDiskUse()
      .toArray()

    const dashboardStatsById = keyBy(dashboardStats, '_id')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        _id: timeLabel,
        totalTransactions: stat?.totalTransactions ?? 0,
        flaggedTransactions: stat?.flaggedTransactions ?? 0,
        stoppedTransactions: stat?.stoppedTransactions ?? 0,
        suspendedTransactions: stat?.suspendedTransactions ?? 0,
        paymentMethods_ACH: stat?.paymentMethods_ACH ?? 0,
        paymentMethods_CARD: stat?.paymentMethods_CARD ?? 0,
        paymentMethods_GENERIC_BANK_ACCOUNT:
          stat?.paymentMethods_GENERIC_BANK_ACCOUNT ?? 0,
        paymentMethods_IBAN: stat?.paymentMethods_IBAN ?? 0,
        paymentMethods_SWIFT: stat?.paymentMethods_SWIFT ?? 0,
        paymentMethods_UPI: stat?.paymentMethods_UPI ?? 0,
        paymentMethods_WALLET: stat?.paymentMethods_WALLET ?? 0,
        paymentMethods_MPESA: stat?.paymentMethods_MPESA ?? 0,
        paymentMethods_CHECK: stat?.paymentMethods_CHECK ?? 0,
        arsRiskLevel_VERY_HIGH: stat?.arsRiskLevel_VERY_HIGH ?? 0,
        arsRiskLevel_HIGH: stat?.arsRiskLevel_HIGH ?? 0,
        arsRiskLevel_MEDIUM: stat?.arsRiskLevel_MEDIUM ?? 0,
        arsRiskLevel_LOW: stat?.arsRiskLevel_LOW ?? 0,
        arsRiskLevel_VERY_LOW: stat?.arsRiskLevel_VERY_LOW ?? 0,
        transactionType_DEPOSIT: stat?.transactionType_DEPOSIT ?? 0,
        transactionType_TRANSFER: stat?.transactionType_TRANSFER ?? 0,
        transactionType_EXTERNAL_PAYMENT:
          stat?.transactionType_EXTERNAL_PAYMENT ?? 0,
        transactionType_WITHDRAWAL: stat?.transactionType_WITHDRAWAL ?? 0,
        transactionType_REFUND: stat?.transactionType_REFUND ?? 0,
        transactionType_OTHER: stat?.transactionType_OTHER ?? 0,
      }
    })
  }
}
