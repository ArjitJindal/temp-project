import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import {
  DashboardTimeFrameType,
  timeFrameValues,
  TransactionDashboardStats,
} from '../constants'
import { padToDate } from '../utils'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
} from '@/utils/mongoDBUtils'

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

  public async getTransactionCountStats(
    timeframe: DashboardTimeFrameType,
    beforeTimestamp: number
  ): Promise<{ transactionStats: TransactionDashboardStats[] }> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const timestampToDate = new Date(beforeTimestamp)

    let collection
    let query
    if (timeframe === timeFrameValues.YEAR) {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(this.tenantId)
      )
      query = {
        _id: {
          $gte: `${timestampToDate.getFullYear()}-${padToDate(
            timestampToDate.getMonth() + 1
          )}`,
        },
      }
    } else if (timeframe === timeFrameValues.MONTH) {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(this.tenantId)
      )
      query = {
        _id: {
          $gte: `${timestampToDate.getFullYear()}-${padToDate(
            timestampToDate.getMonth() + 1
          )}-${padToDate(timestampToDate.getDate())}`,
        },
      }
    } else if (timeframe === timeFrameValues.DAY) {
      collection = db.collection<TransactionDashboardStats>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(this.tenantId)
      )
      query = {
        _id: {
          $gte: `${timestampToDate.getFullYear()}-${padToDate(
            timestampToDate.getMonth() + 1
          )}-${padToDate(timestampToDate.getDate())}`,
        },
      }
    }

    if (collection && query) {
      const transactionStats = await collection
        .find(query)
        .sort({ _id: -1 })

        .toArray()
      return {
        transactionStats,
      }
    }
    return { transactionStats: [] }
  }
}
