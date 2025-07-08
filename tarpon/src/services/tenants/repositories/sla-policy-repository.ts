import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
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
  private dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  public async getSLAPolicies(
    params: DefaultApiGetSlaPoliciesRequest
  ): Promise<Array<SLAPolicy>> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )

    const query: any = { isDeleted: { $ne: true } }
    if (params.type !== undefined) {
      query.type = params.type
    }

    const cursor = collection.find(query).sort({ createdAt: -1 })

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
    await collection.findOneAndUpdate(
      { id: id },
      { $set: { isDeleted: true, updatedAt: Date.now() } }
    )
  }

  public async reassignSLAPolicies(
    assignmentId: string,
    reassignToUserId: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SLAPolicy>(
      SLA_POLICIES_COLLECTION(this.tenantId)
    )
    await collection.updateMany(
      { createdBy: assignmentId },
      {
        $set: {
          createdBy: reassignToUserId,
          updatedAt: Date.now(),
        },
      }
    )
  }

  public async getNewId(update?: boolean): Promise<string> {
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const count = await counterRepository[
      update ? 'getNextCounterAndUpdate' : 'getNextCounter'
    ]('SLAPolicy')
    return `SLA-${count}`
  }
}
