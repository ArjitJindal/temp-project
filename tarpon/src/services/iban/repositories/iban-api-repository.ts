import { MongoClient } from 'mongodb'
import { uniqBy } from 'lodash'
import { IBANApiHistory, IBANBankInfo } from '../types'
import { IBAN_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'

@traceable
export class IBANApiRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveIbanValidationHistory(
    iban: string,
    response: IBANBankInfo,
    rawResponse: object,
    source: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COLLECTION(this.tenantId)
    )
    await collection.insertOne({
      request: { iban },
      response,
      rawResponse,
      source,
      createdAt: Date.now(),
    })
  }
  public async getLatestIbanValidationHistory(
    iban: string
  ): Promise<IBANApiHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COLLECTION(this.tenantId)
    )
    const result = await collection
      .find({ 'request.iban': iban }, { sort: { createdAt: -1 }, limit: 1 })
      .toArray()
    return result[0] ?? null
  }

  public async getLatestIbanValidationHistories(
    ibans: string[]
  ): Promise<IBANApiHistory[] | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COLLECTION(this.tenantId)
    )
    const results = await collection
      .find(
        { 'request.iban': { $in: ibans } },
        // We'll only use the latest query result of a iban
        { sort: { createdAt: -1 } }
      )
      .allowDiskUse()
      .toArray()
    return uniqBy(results, (item) => item.request.iban) ?? null
  }
}
