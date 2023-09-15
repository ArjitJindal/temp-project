import { Filter, MongoClient } from 'mongodb'

import { MERCHANT_MONITORING_DATA_COLLECTION } from '@/utils/mongodb-definitions'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { MerchantMonitoringSource } from '@/@types/openapi-internal/MerchantMonitoringSource'
import { traceable } from '@/core/xray'

@traceable
export class MerchantRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async createMerchant(
    userId: string,
    domain: string,
    companyName: string,
    merchantSummary: MerchantMonitoringSummary
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<MerchantMonitoringSummary>(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )
    return await collection.insertOne({
      ...merchantSummary,
      updatedAt: new Date().getTime(),
      userId,
      domain,
      companyName,
    })
  }

  public async getSummaries(
    userId: string
  ): Promise<MerchantMonitoringSummary[] | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<MerchantMonitoringSummary>(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )
    return await collection
      .aggregate([
        {
          $match: {
            userId,
          },
        },
        {
          $sort: {
            userId: 1,
            'source.sourceType': 1,
            'source.sourceValue': 1,
            updatedAt: 1,
          },
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              sourceType: '$source.sourceType',
              sourceValue: '$source.sourceValue',
            },
            newest_document: {
              $last: '$$ROOT',
            },
          },
        },
        {
          $replaceWith: '$newest_document',
        },
        {
          $sort: {
            'source.sourceType': 1,
            'source.sourceValue': 1,
          },
        },
      ])
      .toArray()
  }

  public async getSummaryHistory(
    userId: string,
    source: MerchantMonitoringSource
  ): Promise<MerchantMonitoringSummary[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<MerchantMonitoringSummary>(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )

    return await collection
      .find({ userId, source })
      .sort({ updatedAt: -1 })
      .toArray()
  }

  public getSummaryHistoryBySourceType(
    userId: string,
    sourceType: MerchantMonitoringSource['sourceType'],
    filter?: Filter<MerchantMonitoringSummary>
  ): Promise<MerchantMonitoringSummary[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<MerchantMonitoringSummary>(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )

    return collection
      .find({
        userId,
        'source.sourceType': sourceType,
        ...filter,
      })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray()
  }
}
