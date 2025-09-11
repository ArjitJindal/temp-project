import keyBy from 'lodash/keyBy'
import { getTimeLabels } from '../../dashboard/utils'
import {
  GranularityValuesType,
  TimeRange,
} from '../../dashboard/repositories/types'
import {
  cleanUpStaleData,
  executeTimeBasedClickhouseQuery,
  getAttributeCountStatsPipeline,
  getAttributeSumStatsDerivedPipeline,
  withUpdatedAt,
} from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { traceable } from '@/core/xray'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { hasFeature } from '@/core/utils/context'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { notEmpty, notNullish } from '@/utils/array'
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStatsClosingReasonsData'
import { EXTRA_TRANSACTION_STATUSS } from '@/@types/openapi-internal-custom/ExtraTransactionStatus'
async function createInexes(tenantId) {
  const db = await getMongoDbClientDb()
  for (const collection of [
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId),
  ]) {
    await db.collection(collection).createIndex(
      {
        time: 1,
        ready: 1,
      },
      {
        unique: true,
      }
    )
    await db.collection(collection).createIndex({
      updatedAt: 1,
    })
  }
}

type ReturnType =
  Array<DashboardStatsClosingReasonDistributionStatsClosingReasonsData>

@traceable
export class TransactionStatsDashboardMetric {
  public static async refresh(
    tenantId: string,
    timeRange?: TimeRange
  ): Promise<void> {
    await createInexes(tenantId)
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, { mongoDb, dynamoDb })
    const lastUpdatedAt = Date.now()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const riskClassifications =
      await riskRepository.getRiskClassificationValues()

    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    const aggregatedDailyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
    const aggregatedMonthlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)

    // Hourly Stats
    await transactionsCollection
      .aggregate(
        withUpdatedAt(
          getAttributeCountStatsPipeline(
            aggregatedHourlyCollectionName,
            'HOUR',
            'timestamp',
            'status',
            ['status'],
            timeRange
          ),
          lastUpdatedAt
        ),
        { allowDiskUse: true }
      )
      .next()

    await transactionsCollection
      .aggregate(
        withUpdatedAt(
          getAttributeCountStatsPipeline(
            aggregatedHourlyCollectionName,
            'HOUR',
            'timestamp',
            'status',
            ['status'],
            timeRange,
            {
              preProcessingPipeline: [
                {
                  $match: {
                    hitRules: {
                      $not: {
                        $size: 0,
                      },
                    },
                    'hitRules.ruleAction': {
                      $in: ['SUSPEND'],
                      $nin: ['BLOCK'],
                    },
                    status: {
                      $in: ['ALLOW', 'BLOCK'],
                    },
                  },
                },
                {
                  $replaceWith: {
                    status: {
                      $concat: ['$status', '_MANUAL'],
                    },
                    timestamp: '$timestamp',
                  },
                },
              ],
            }
          ),
          lastUpdatedAt
        ),
        { allowDiskUse: true }
      )
      .next()
    await transactionsCollection
      .aggregate(
        withUpdatedAt(
          getAttributeCountStatsPipeline(
            aggregatedHourlyCollectionName,
            'HOUR',
            'timestamp',
            'paymentMethods',
            ['originPaymentDetails.method', 'destinationPaymentDetails.method'],
            timeRange
          ),
          lastUpdatedAt
        ),
        {
          allowDiskUse: true,
        }
      )
      .next()

    if (hasFeature('RISK_SCORING')) {
      const pipeline = withUpdatedAt(
        getAttributeCountStatsPipeline(
          aggregatedHourlyCollectionName,
          'HOUR',
          'timestamp',
          'arsRiskLevel',
          ['arsScore.riskLevel'],
          timeRange,
          {
            attributeFieldMapper: {
              $let: {
                vars: {
                  riskLevel: {
                    $function: {
                      body: `function(riskScore, riskClassifications) {
                        if (riskScore === null) return 'VERY_HIGH';
                        for (const classification of riskClassifications) {
                          if (riskScore >= classification.lowerBoundRiskScore && 
                              riskScore < classification.upperBoundRiskScore) {
                            return classification.riskLevel;
                          }
                        }
                        return 'VERY_HIGH';
                      }`,
                      args: ['$arsScore.arsScore', riskClassifications],
                      lang: 'js',
                    },
                  },
                },
                in: '$$riskLevel',
              },
            },
          }
        ),
        lastUpdatedAt
      )

      await transactionsCollection
        .aggregate(pipeline, {
          allowDiskUse: true,
        })
        .next()
    }

    await cleanUpStaleData(
      aggregatedHourlyCollectionName,
      'time',
      lastUpdatedAt,
      timeRange,
      'HOUR'
    )

    // Daily stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedHourlyCollectionName
      )
      .aggregate(
        withUpdatedAt(
          getAttributeSumStatsDerivedPipeline(
            aggregatedDailyCollectionName,
            'DAY',
            timeRange
          ),
          lastUpdatedAt
        ),
        {
          allowDiskUse: true,
        }
      )
      .next()
    await cleanUpStaleData(
      aggregatedDailyCollectionName,
      'time',
      lastUpdatedAt,
      timeRange,
      'DAY'
    )

    // Monthly stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedDailyCollectionName
      )
      .aggregate(
        withUpdatedAt(
          getAttributeSumStatsDerivedPipeline(
            aggregatedMonthlyCollectionName,
            'MONTH',
            timeRange
          ),
          lastUpdatedAt
        ),
        {
          allowDiskUse: true,
        }
      )
      .next()
    await cleanUpStaleData(
      aggregatedMonthlyCollectionName,
      'time',
      lastUpdatedAt,
      timeRange,
      'MONTH'
    )
  }

  public static async getFromClickhouse(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType,
    returnDataType: 'TOTAL' | 'DATE_RANGE' = 'DATE_RANGE'
  ): Promise<DashboardStatsTransactionsCountData[]> {
    const tableDefinition = CLICKHOUSE_DEFINITIONS.TRANSACTIONS
    const tableName = tableDefinition.tableName

    function buildQueryPart(
      items: string[],
      aliasPrefix: string,
      ...fields: string[]
    ): string {
      return items
        .map(
          (item) =>
            fields.map((field) => `COUNTIf(${field} = '${item}')`).join(' + ') +
            ` as ${aliasPrefix}_${item}`
        )
        .join(', ')
    }

    const paymentMethods = buildQueryPart(
      PAYMENT_METHODS,
      'paymentMethods',
      'originPaymentMethod',
      'destinationPaymentMethod'
    )

    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const ruleActions = buildQueryPart(RULE_ACTIONS, 'status', 'status')
    const manualActions = buildQueryPart(
      EXTRA_TRANSACTION_STATUSS,
      'status',
      'derived_status'
    )
    const arsRiskLevels = riskClassificationValues
      .map(({ riskLevel }) => {
        const classification = riskClassificationValues.find(
          (c) => c.riskLevel === riskLevel
        )
        if (!classification) {
          return ''
        }

        const isHighestRiskLevel = classification.upperBoundRiskScore === 100
        const condition = isHighestRiskLevel
          ? `arsScore_arsScore >= ${classification.lowerBoundRiskScore}`
          : `arsScore_arsScore >= ${classification.lowerBoundRiskScore} AND arsScore_arsScore < ${classification.upperBoundRiskScore}`

        return `COUNTIf(${condition}) AS arsRiskLevel_${riskLevel}`
      })
      .filter(Boolean)
      .join(', ')
    const dateRangeQuery =
      returnDataType === 'DATE_RANGE'
        ? `, ${ruleActions}, ${manualActions}, ${arsRiskLevels}`
        : ''

    return await executeTimeBasedClickhouseQuery<DashboardStatsTransactionsCountData>(
      tenantId,
      tableName,
      granularity,
      `
      ${paymentMethods}
      ${dateRangeQuery}
      `,
      { startTimestamp, endTimestamp },
      'timestamp != 0',
      { countOnly: returnDataType === 'TOTAL' }
    )
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity: GranularityValuesType,
    type?: 'TOTAL' | 'DATE_RANGE'
  ): Promise<DashboardStatsTransactionsCountData[]> {
    if (isClickhouseEnabled()) {
      return this.getFromClickhouse(
        tenantId,
        startTimestamp,
        endTimestamp,
        granularity,
        type
      )
    }
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
        time: {
          $gte: startDate,
          $lte: endDate,
        },
        ready: { $ne: false },
      })
      .sort({ time: 1 })
      .allowDiskUse()
      .toArray()

    const dashboardStatsById = keyBy(dashboardStats, 'time')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        time: timeLabel,
        ...stat,
      }
    })
  }

  public static async getPaymentClosingReasonDistributionStatistics(
    tenantId: string,
    params?: {
      startTimestamp: number | undefined
      endTimestamp: number | undefined
    }
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    let closingReasonsData: DashboardStatsClosingReasonDistributionStatsClosingReasonsData[] =
      []
    if (isClickhouseEnabled()) {
      const clickhouse = await getClickhouseClient(tenantId)
      // rank window function as CTE to filter latest txn event for each txn id
      const query = `
        WITH latestEvents AS (
          SELECT *
          FROM (
            SELECT transactionId, timestamp, status, reasons,
                   row_number() OVER (PARTITION BY transactionId ORDER BY timestamp DESC) AS row_rank
            FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName}
            WHERE status IN ('ALLOW', 'BLOCK')
              ${
                params?.startTimestamp
                  ? `AND timestamp >= ${params.startTimestamp}`
                  : ''
              }
              ${
                params?.endTimestamp
                  ? `AND timestamp <= ${params.endTimestamp}`
                  : ''
              }
          )
          WHERE row_rank = 1
        )
        SELECT
          concat(r, ' (', any(status), ')') AS reason,
          count(*) AS value
        FROM latestEvents
        ARRAY JOIN reasons AS r
        GROUP BY r
        ORDER BY reason ASC;
      `
      closingReasonsData = await executeClickhouseQuery<ReturnType>(
        clickhouse,
        { query, format: 'JSONEachRow' }
      )
    } else {
      const db = await getMongoDbClientDb()
      const transactionEventCollection = db.collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(tenantId)
      )
      const reasons = await transactionEventCollection
        .aggregate(
          [
            { $match: { status: { $in: ['ALLOW', 'BLOCK'] } } },
            params?.startTimestamp != null || params?.endTimestamp != null
              ? {
                  $match: {
                    $and: [
                      params?.startTimestamp != null && {
                        timestamp: {
                          $gte: params?.startTimestamp,
                        },
                      },
                      params?.endTimestamp != null && {
                        timestamp: {
                          $lte: params?.endTimestamp,
                        },
                      },
                    ].filter(notEmpty),
                  },
                }
              : null,
            // pipeline to pick only latest transaction event
            {
              $sort: {
                transactionId: 1,
                timestamp: -1,
              },
            },
            {
              $group: {
                _id: '$transactionId',
                doc: {
                  $first: '$$ROOT',
                },
              },
            },
            {
              $replaceRoot: {
                newRoot: '$doc',
              },
            },
            // unwinding the reasons
            {
              $project: {
                reasons: {
                  $split: ['$reason', ','],
                },
                status: 1,
              },
            },
            {
              $unwind: '$reasons',
            },
            {
              $project: {
                reasonWithStatus: {
                  $concat: [
                    { $trim: { input: '$reasons' } },
                    ' (',
                    '$status',
                    ')',
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$reasonWithStatus',
                count: { $sum: 1 },
              },
            },
          ].filter(notNullish)
        )
        .toArray()
      console.info(reasons)
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    }

    return {
      closingReasonsData: closingReasonsData.map((reason) => ({
        reason: reason.reason?.replace(/"/g, ''),
        value: Number(reason.value),
      })),
    }
  }
}
