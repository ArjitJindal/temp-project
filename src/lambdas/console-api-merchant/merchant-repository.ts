import { MongoClient } from 'mongodb'
import { MERCHANT_MONITORING_DATA_COLLECTION } from '@/utils/mongoDBUtils'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'

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
    domain: string,
    companyName: string,
    merchantSummary: MerchantMonitoringSummary
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )
    return await collection.replaceOne(
      { domain, companyName },
      { ...merchantSummary, companyName, domain },
      { upsert: true }
    )
  }

  public async getMerchant(
    domain: string,
    name: string
  ): Promise<MerchantMonitoringSummary[] | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<MerchantMonitoringSummary>(
      MERCHANT_MONITORING_DATA_COLLECTION(this.tenantId)
    )
    return await collection
      .find({ domain: domain, companyName: name })
      .toArray()
  }
}
