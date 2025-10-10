import { getAttributeCountStatsPipeline, withUpdatedAt } from './utils'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { DashboardStatsTransactionTypeDistribution } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistribution'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongo-table-names'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DAY_DATE_FORMAT_JS } from '@/core/constants'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import dayjs from '@/utils/dayjs'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

async function createIndexes(tenantId: string) {
  const db = await getMongoDbClientDb()
  for (const collection of [
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId),
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
export class TransactionsTypeDistributionDashboardMetric {
  public static async clickhouseData(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsTransactionTypeDistribution> {
    try {
      return await this.clickhouseDataOptimized(
        tenantId,
        startTimestamp,
        endTimestamp
      )
    } catch (error) {
      logger.warn(
        'Optimized query failed, falling back to ReplacingMergeTree approach:',
        error
      )
      return await this.clickhouseDataWithDeduplication(
        tenantId,
        startTimestamp,
        endTimestamp
      )
    }
  }

  public static async clickhouseDataOptimized(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsTransactionTypeDistribution> {
    const clickhouseClient = await getClickhouseClient(tenantId)

    const daysDiff = (endTimestamp - startTimestamp) / (1000 * 60 * 60 * 24)

    let query: string
    if (daysDiff < 31) {
      logger.debug(
        `Small dataset expected (${daysDiff} days), using exact counting`
      )
      query = `
        SELECT 
          type,
          uniqExact(id) as count
        FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE.table}
        WHERE timestamp >= ${startTimestamp} 
          AND timestamp <= ${endTimestamp}
        GROUP BY type
      `
    } else {
      // Large dataset: Use daily uniqState for efficiency
      logger.debug(
        `Large dataset expected (${daysDiff} days), using daily uniqState`
      )
      query = `
        SELECT 
          type,
          uniqMerge(unique_transactions) as count
        FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE_DAILY.table}
        WHERE day >= toDate(toDateTime(${startTimestamp} / 1000))
          AND day <= toDate(toDateTime(${endTimestamp} / 1000))
        GROUP BY type
      `
    }

    const queryResult = await executeClickhouseQuery<
      { type: string; count: number }[]
    >(clickhouseClient, {
      query,
      format: 'JSONEachRow',
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 1,
      },
    })

    return {
      data: queryResult.map(({ type, count }) => ({
        type,
        count,
      })),
    }
  }

  public static async clickhouseDataWithDeduplication(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsTransactionTypeDistribution> {
    const clickhouseClient = await getClickhouseClient(tenantId)

    const queryResult = await executeClickhouseQuery<
      { type: string; count: number }[]
    >(clickhouseClient, {
      query: `
        SELECT 
          type,
          uniqExact(id) as count
        FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName}
        WHERE timestamp >= ${startTimestamp} 
          AND timestamp <= ${endTimestamp}
        GROUP BY type
        `,
      format: 'JSONEachRow',
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 1,
      },
    })

    return {
      data: queryResult.map(({ type, count }) => ({
        type,
        count,
      })),
    }
  }

  public static async refresh(
    tenantId: string,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const lastUpdatedAt = Date.now()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    await createIndexes(tenantId)
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
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsTransactionTypeDistribution> {
    if (isClickhouseEnabled()) {
      return this.clickhouseData(tenantId, startTimestamp, endTimestamp)
    }

    const db = await getMongoDbClientDb()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
    )

    const startDate = dayjs(startTimestamp).format(DAY_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(DAY_DATE_FORMAT_JS)

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

    // sum by transactionType which will have prefix transactionType_
    const mappedTransactionStats = new Map<string, number>()
    dashboardStats.forEach((stat) => {
      Object.entries(stat).forEach(([key, value]) => {
        if (typeof value !== 'number') {
          return
        }

        if (key.startsWith('transactionType_')) {
          const transactionType = key.replace('transactionType_', '')
          const currentCount = mappedTransactionStats.get(transactionType) || 0
          mappedTransactionStats.set(transactionType, currentCount + value)
        }
      })
    })

    return {
      data: Array.from(mappedTransactionStats.entries()).map(
        ([type, count]) => ({
          type,
          count,
        })
      ),
    }
  }
}
