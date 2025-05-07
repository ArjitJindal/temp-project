import { getAttributeCountStatsPipeline, withUpdatedAt } from './utils'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { DashboardStatsTransactionTypeDistribution } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistribution'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DAY_DATE_FORMAT_JS } from '@/core/constants'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import dayjs from '@/utils/dayjs'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { traceable } from '@/core/xray'

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
    const clickhouseClient = await getClickhouseClient(tenantId)

    const queryResult = await executeClickhouseQuery<
      { type: string; count: number }[]
    >(clickhouseClient, {
      query: `
        SELECT 
          type,
          COUNT() as count
        FROM transactions FINAL
        WHERE timestamp >= ${startTimestamp} AND timestamp <= ${endTimestamp} AND timestamp != 0
        GROUP BY type
        `,
      format: 'JSONEachRow',
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 1,
      },
    })

    console.log(queryResult)

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
