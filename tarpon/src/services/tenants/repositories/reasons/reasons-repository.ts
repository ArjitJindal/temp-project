import { NotFound } from 'http-errors'
import { Collection, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoReasonsRepository } from './dynamo-repository'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'
import { traceable } from '@/core/xray'
import { REASONS_COLLECTION } from '@/utils/mongodb-definitions'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { isClickhouseMigrationEnabled } from '@/utils/clickhouse/utils'

@traceable
export class ReasonsRepository {
  private collection: Collection<ConsoleActionReason>
  private dynamoReasonsRepository: DynamoReasonsRepository
  private mongoDb: MongoClient
  private dynamoDb: DynamoDBDocumentClient
  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
      dynamoDb?: DynamoDBDocumentClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    const db = this.mongoDb.db()
    this.collection = db.collection<ConsoleActionReason>(
      REASONS_COLLECTION(tenantId)
    )
    this.dynamoReasonsRepository = new DynamoReasonsRepository(
      tenantId,
      this.dynamoDb
    )
  }
  private async getReason(
    id: string,
    reasonType: ReasonType
  ): Promise<ConsoleActionReason | null> {
    if (isClickhouseMigrationEnabled()) {
      return await this.dynamoReasonsRepository.getReason(id, reasonType)
    }
    const query: {
      id: string
      isDeleted: { $ne: true }
      reasonType?: ReasonType
    } = {
      id: id,
      isDeleted: { $ne: true },
      reasonType: reasonType,
    }
    const existingRecord = await this.collection.findOne(query)
    return existingRecord
  }

  public async getReasons(type?: ReasonType): Promise<ConsoleActionReason[]> {
    if (isClickhouseMigrationEnabled()) {
      return await this.dynamoReasonsRepository.getReasons(type)
    }
    const reasons = await this.collection
      .find({
        reasonType: type ? type : { $exists: true },
        isDeleted: { $ne: true },
      })
      .sort({ id: 1 })
      .toArray()
    return reasons
  }

  public async updateReason(
    id: string,
    reasonType: ReasonType,
    actionReason: Partial<ConsoleActionReason>
  ) {
    const updatedAt = Date.now()
    await this.dynamoReasonsRepository.updateReason(
      id,
      reasonType,
      actionReason,
      updatedAt
    )

    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }
    await this.collection.updateOne(
      { id, reasonType },
      { $set: { ...actionReason, updatedAt } }
    )
    return { ...existingRecord, ...actionReason }
  }

  public async bulkAddReasons(actionReasons: ConsoleActionReason[]) {
    await this.dynamoReasonsRepository.saveReasons(actionReasons)
    return await this.collection.insertMany(actionReasons)
  }

  public async deleteReason(id: string, reasonType: ReasonType) {
    await this.dynamoReasonsRepository.deleteReason(id, reasonType)
    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }
    return await this.collection.updateOne(
      { id: id },
      {
        $set: {
          isDeleted: true,
          updatedAt: Date.now(),
        },
      }
    )
  }
}
