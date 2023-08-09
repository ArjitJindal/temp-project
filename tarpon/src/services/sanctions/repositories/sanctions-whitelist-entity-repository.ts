import { MongoClient } from 'mongodb'
import {
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
  withTransaction,
} from '@/utils/mongoDBUtils'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { traceable } from '@/core/xray'

export type SanctionsWhitelistEntity = {
  createdAt: number
  caEntity: ComplyAdvantageSearchHitDoc
  userId?: string
  reason?: string
  comment?: string
}

@traceable
export class SanctionsWhitelistEntityRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async addWhitelistEntities(
    caEntities: ComplyAdvantageSearchHitDoc[],
    userId?: string,
    options?: {
      reason?: string
      comment?: string
      createdAt?: number
    }
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )

    await withTransaction(async () => {
      await Promise.all(
        caEntities.map((caEntity) =>
          collection.replaceOne(
            { 'caEntity.id': caEntity.id, userId },
            {
              caEntity,
              userId,
              createdAt: options?.createdAt ?? Date.now(),
              reason: options?.reason,
              comment: options?.comment,
            },
            { upsert: true }
          )
        )
      )
    })
  }

  public async removeWhitelistEntities(
    caEntityIds: string[],
    userId?: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    await collection.deleteMany({
      'caEntity.id': { $in: caEntityIds },
      userId,
    })
  }

  public async getWhitelistEntities(
    requestEntityIds: string[],
    userId?: string
  ): Promise<SanctionsWhitelistEntity[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const result = await collection
      .find({ 'caEntity.id': { $in: requestEntityIds }, userId })
      .toArray()
    return result
  }
}
