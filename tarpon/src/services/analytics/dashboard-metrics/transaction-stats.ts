import { keyBy, startCase } from 'lodash'
import { getTimeLabels } from '../../dashboard/utils'
import {
  GranularityValuesType,
  TimeRange,
} from '../../dashboard/repositories/types'
import {
  cleanUpStaleData,
  getAttributeCountStatsPipeline,
  getAttributeSumStatsDerivedPipeline,
  withUpdatedAt,
} from './utils'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
  getMongoDbClient,
  getMongoDbClientDb,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/utils/mongodb-utils'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { traceable } from '@/core/xray'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import { hasFeature } from '@/core/utils/context'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { logger } from '@/core/logger'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
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

@traceable
export class TransactionStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
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
    await transactionsCollection
      .aggregate(
        withUpdatedAt(
          getAttributeCountStatsPipeline(
            aggregatedHourlyCollectionName,
            'HOUR',
            'timestamp',
            'transactionType',
            ['type'],
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
              $switch: {
                branches: riskClassifications.map((classification) => ({
                  case: {
                    $and: [
                      {
                        $gte: [
                          '$arsScore.arsScore',
                          classification.lowerBoundRiskScore,
                        ],
                      },
                      {
                        $lt: [
                          '$arsScore.arsScore',
                          classification.upperBoundRiskScore,
                        ],
                      },
                    ],
                  },
                  then: classification.riskLevel,
                })),
                default: DEFAULT_RISK_LEVEL,
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
    granularity?: GranularityValuesType,
    returnDataType: 'TOTAL' | 'DATE_RANGE' = 'DATE_RANGE'
  ): Promise<DashboardStatsTransactionsCountData[]> {
    const client = await getClickhouseClient(tenantId)
    const tableDefinition = CLICKHOUSE_DEFINITIONS.TRANSACTIONS
    const tableName = tableDefinition.tableName

    const type = granularity?.toLowerCase() ?? 'hour'
    const timeFormat = type === 'month' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'
    const gte = dayjs(startTimestamp).format(timeFormat)
    const lte = dayjs(endTimestamp).format(timeFormat)

    function buildTimeQuery(): string {
      return `toStartOf${startCase(type)}(toDateTime(timestamp / 1000))`
    }

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

    function buildAggregatorQuery(type: string): string {
      return `
    GROUP BY time 
    ORDER BY time ASC 
    WITH FILL 
    FROM toStartOf${startCase(type)}(toDateTime('${gte}')) 
    TO toStartOf${startCase(
      type
    )}(toDateTime('${lte}')) + INTERVAL 1 ${type.toUpperCase()} 
    STEP INTERVAL 1 ${type.toUpperCase()}
  `
    }

    const timeQuery = returnDataType === 'TOTAL' ? "''" : buildTimeQuery()

    const paymentMethods = buildQueryPart(
      PAYMENT_METHODS,
      'paymentMethods',
      'originPaymentMethod',
      'destinationPaymentMethod'
    )
    const transactionTypes = buildQueryPart(
      TRANSACTION_TYPES,
      'transactionType',
      'type'
    )
    const ruleActions = buildQueryPart(RULE_ACTIONS, 'status', 'status')
    const arsRiskLevels = buildQueryPart(
      RISK_LEVELS,
      'arsRiskLevel',
      'arsScore_riskLevel'
    )

    const dateRangeQuery =
      returnDataType === 'DATE_RANGE'
        ? `, ${ruleActions}, ${arsRiskLevels}`
        : ''

    const aggregatorQuery =
      returnDataType === 'DATE_RANGE' ? buildAggregatorQuery(type) : ''

    const query = `
    SELECT ${timeQuery} as time, ${paymentMethods}, ${transactionTypes} ${dateRangeQuery}
    FROM ${tableName}
    WHERE toDateTime(timestamp / 1000) BETWEEN toDateTime('${gte}') AND toDateTime('${lte}')
    ${aggregatorQuery}
    SETTINGS output_format_json_quote_64bit_integers = 0
  `

    logger.info('Running query', { query })

    const queryResult = await client.query({
      query,
      format: 'JSONEachRow',
    })

    const data = await queryResult.json<DashboardStatsTransactionsCountData>()

    if (returnDataType === 'DATE_RANGE') {
      data.forEach((item) => {
        item.time = dayjs(item.time).format(
          type === 'hour'
            ? HOUR_DATE_FORMAT_JS
            : type === 'day'
            ? DAY_DATE_FORMAT_JS
            : MONTH_DATE_FORMAT_JS
        )
      })
    }

    return data
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType,
    type?: 'TOTAL' | 'DATE_RANGE'
  ): Promise<DashboardStatsTransactionsCountData[]> {
    if (hasFeature('CLICKHOUSE_ENABLED')) {
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
}
