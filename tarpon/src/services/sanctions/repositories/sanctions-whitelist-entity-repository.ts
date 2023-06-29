import { MongoClient } from 'mongodb'
import {
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
  withTransaction,
} from '@/utils/mongoDBUtils'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'

export type SanctionsWhitelistEntity = {
  _id: string
  caEntity: ComplyAdvantageSearchHitDoc
  userId?: string
  createdAt: number
}

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
    createdAt?: number
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )

    await withTransaction(async () => {
      await Promise.all(
        caEntities.map((caEntity) =>
          collection.replaceOne(
            { _id: caEntity.id },
            {
              caEntity,
              userId,
              createdAt: createdAt ?? Date.now(),
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
      _id: { $in: caEntityIds },
      userId,
    })
  }

  public async getWhitelistEntityIds(
    requestEntityIds: string[],
    userId?: string
  ): Promise<string[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const result = await collection
      .find({ _id: { $in: requestEntityIds }, userId })
      .toArray()
    return result.map((item) => item._id)
  }
}
