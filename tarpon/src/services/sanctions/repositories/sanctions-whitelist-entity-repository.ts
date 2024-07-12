import { MongoClient, Filter } from 'mongodb'
import { withTransaction } from '@/utils/mongodb-utils'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { traceable } from '@/core/xray'
import {
  CursorPaginationParams,
  cursorPaginate,
  CursorPaginationResponse,
} from '@/utils/pagination'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'

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

  public async searchWhitelistEntities(
    params: {
      filterUserId?: string[]
    } & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsWhitelistEntity>> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsWhitelistEntity>(
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
    )
    const filter: Filter<SanctionsWhitelistEntity> = {}
    if (params.filterUserId) {
      filter.userId = { $in: params.filterUserId }
    }
    return cursorPaginate<SanctionsWhitelistEntity>(collection, filter, {
      ...params,
      sortField: params.sortField || 'createdAt',
    })
  }
}
