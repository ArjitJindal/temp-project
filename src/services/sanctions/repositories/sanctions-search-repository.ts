import { AggregationCursor, MongoClient, Document } from 'mongodb'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  paginateCursor,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongoDBUtils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { PaginationParams } from '@/utils/pagination'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'

export class SanctionsSearchRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSearchResult(
    request: SanctionsSearchRequest,
    response: SanctionsSearchResponse
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    await collection.insertOne({
      _id: request._id as any,
      request,
      response,
      createdAt: Date.now(),
    })
  }

  private async getSanctionsSearchCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const pipeline: Document[] = [
      {
        $count: 'count',
      },
    ]

    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline)
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getSearchHistory(
    params: PaginationParams
  ): Promise<SanctionsSearchHistoryResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    let cursor = collection
      .find({}, { projection: { response: false } })
      .sort({ createdAt: -1 })
    cursor = paginateCursor(cursor, params)
    const total = this.getSanctionsSearchCount()
    return { total: await total, items: await cursor.toArray() }
  }

  public async getSearchResult(
    searchId: string
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ _id: searchId as any })
  }
}
