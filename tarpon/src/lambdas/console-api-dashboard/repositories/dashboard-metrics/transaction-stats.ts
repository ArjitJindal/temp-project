import { keyBy } from 'lodash'
import { getTimeLabels } from '../../utils'
import { GranularityValuesType, TimeRange } from '../types'
import {
  cleanUpStaleData,
  getAttributeCountStatsPipeline,
  getAttributeSumStatsDerivedPipeline,
  withUpdatedAt,
} from './utils'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
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
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { traceable } from '@/core/xray'

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
  }
}

@traceable
export class TransactionStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    await createInexes(tenantId)
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
    await transactionsCollection
      .aggregate(
        withUpdatedAt(
          getAttributeCountStatsPipeline(
            aggregatedHourlyCollectionName,
            'HOUR',
            'timestamp',
            'arsRiskLevel',
            ['arsScore.riskLevel'],
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
