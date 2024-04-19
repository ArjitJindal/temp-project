import { MongoClient } from 'mongodb'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { COUNTER_COLLECTION } from '@/utils/mongodb-definitions'

export class CounterRepository {
  private tenantId: string
  private mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async getNextCounterAndUpdate(entity: string): Promise<number> {
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOneAndUpdate(
      { entity },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    )

    return data.value?.count ?? 1
  }

  public async getNextCounter(entity: string): Promise<number> {
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOne({ entity })

    return data?.count ?? 1
  }
}
