import { MongoClient } from 'mongodb'
import { IBANApiHistory, IBANValidationResponse } from '../types'
import { IBAN_COM_COLLECTION } from '@/utils/mongoDBUtils'
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
    response: IBANValidationResponse
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COM_COLLECTION(this.tenantId)
    )
    await collection.insertOne({
      type: 'IBAN_VALIDATION',
      request: { iban },
      response,
      createdAt: Date.now(),
    })
  }
  public async getLatestIbanValidationHistory(
    iban: string
  ): Promise<IBANApiHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COM_COLLECTION(this.tenantId)
    )
    const result = await collection
      .find(
        { type: 'IBAN_VALIDATION', 'request.iban': iban },
        { sort: { createdAt: -1 }, limit: 1 }
      )
      .toArray()
    return result[0] ?? null
  }

  public async getLatestIbanValidationHistories(
    ibans: string[]
  ): Promise<IBANApiHistory[] | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<IBANApiHistory>(
      IBAN_COM_COLLECTION(this.tenantId)
    )
    const results = await collection
      .find(
        { type: 'IBAN_VALIDATION', 'request.iban': { $in: ibans } },
        { sort: { createdAt: -1 }, limit: 1 }
      )
      .toArray()
    return results ?? null
  }
}
