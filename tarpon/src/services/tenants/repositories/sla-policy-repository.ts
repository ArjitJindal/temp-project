import { MongoClient } from 'mongodb'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { traceable } from '@/core/xray'
import { SLA_POLICIES_COLLECTION } from '@/utils/mongodb-definitions'
import { paginateCursor } from '@/utils/mongodb-utils'
import { CounterRepository } from '@/services/counter/repository'
import { DefaultApiGetSlaPoliciesRequest } from '@/@types/openapi-internal/RequestParameters'
@traceable
export class SLAPolicyRepository {
  private tenantId: string
  private mongoDb: MongoClient
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }
  public async getSLAPolicies(
    params: DefaultApiGetSlaPoliciesRequest
  ): Promise<Array<SLAPolicy>> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    const cursor = collection.find({}).sort({ createdAt: -1 })
    const paginatedCursor = paginateCursor<
      DefaultApiGetSlaPoliciesRequest,
      SLAPolicy
    >(cursor, params)

    return (await paginatedCursor?.toArray()) ?? []
  }
  public async getSLAPolicyById(id: string): Promise<SLAPolicy | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ id: id })
  }

  public async createSLAPolicy(policy: SLAPolicy): Promise<SLAPolicy> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    await collection.insertOne(policy)
    return policy
  }

  public async updateSLAPolicy(policy: SLAPolicy): Promise<SLAPolicy> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    await collection.updateOne({ id: policy.id }, { $set: policy })
    return policy
  }

  public async deleteSLAPolicy(id: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ id: id })
  }

  public async getNewId(update?: boolean): Promise<string> {
    const counterRepository = new CounterRepository(this.tenantId, this.mongoDb)
    const count = await counterRepository[
      update ? 'getNextCounterAndUpdate' : 'getNextCounter'
    ]('SLAPolicy')
    return `SLA-${count}`
  }
}
