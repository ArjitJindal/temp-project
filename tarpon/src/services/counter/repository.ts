import { MongoClient } from 'mongodb'
import { COUNTER_COLLECTION } from '@/utils/mongodb-definitions'

export type CounterEntity =
  | 'Case'
  | 'Alert'
  | 'AlertQASample'
  | 'Report'
  | 'RC'
  | 'SanctionsHit'
  | 'CustomRiskFactor'
  | 'SanctionsWhitelist'

export const COUNTER_ENTITIES: CounterEntity[] = [
  'Case',
  'Alert',
  'AlertQASample',
  'Report',
  'RC',
  'CustomRiskFactor',
]
export type EntityCounter = {
  _id?: string
  entity: CounterEntity
  count: number
}

export class CounterRepository {
  private tenantId: string
  private mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  // If an entity doesn't have a counter yet, we need to initialize it with 0. Otherwise,
  // if multilpe callers call `getNextCounterAndUpdate` concurrently, we could end up with
  // duplicate counters.
  public async initialize(): Promise<void> {
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)
    for (const entity of COUNTER_ENTITIES) {
      if (!(await collection.findOne({ entity }))) {
        await collection.insertOne({ entity, count: 0 })
      }
    }
  }

  public async getNextCounterAndUpdate(entity: CounterEntity): Promise<number> {
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

  public async getNextCountersAndUpdate(
    entity: CounterEntity,
    count: number
  ): Promise<number[]> {
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOneAndUpdate(
      { entity },
      { $inc: { count } },
      { upsert: true, returnDocument: 'after' }
    )

    const value = data.value?.count ?? 1
    return [...new Array(count)].map((_, i) => value - i)
  }

  public async getNextCounter(entity: CounterEntity): Promise<number> {
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOne({ entity })
    return (data?.count ?? 0) + 1
  }
}
