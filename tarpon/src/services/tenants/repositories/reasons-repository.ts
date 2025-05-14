import { NotFound } from 'http-errors'
import { Collection, MongoClient } from 'mongodb'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'
import { traceable } from '@/core/xray'
import { REASONS_COLLECTION } from '@/utils/mongodb-definitions'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'

@traceable
export class ReasonsRepository {
  private collection: Collection<ConsoleActionReason>
  constructor(tenantId: string, mongoDb: MongoClient) {
    const db = mongoDb.db()
    this.collection = db.collection<ConsoleActionReason>(
      REASONS_COLLECTION(tenantId)
    )
  }
  private async getReason(
    id: string,
    reasonType: ReasonType
  ): Promise<ConsoleActionReason | null> {
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
    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }
    await this.collection.updateOne(
      { id, reasonType },
      { $set: { ...actionReason, updatedAt: Date.now() } }
    )
    return { ...existingRecord, ...actionReason }
  }

  public async bulkAddReasons(actionReasons: ConsoleActionReason[]) {
    return await this.collection.insertMany(actionReasons)
  }

  public async deleteReason(id: string, reasonType: ReasonType) {
    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }
    return await this.collection.updateOne(
      { id: id },
      { ...existingRecord, isDeleted: true, updatedAt: Date.now() } // Soft Deleting
    )
  }
}
