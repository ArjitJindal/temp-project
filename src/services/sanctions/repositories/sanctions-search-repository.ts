import { AggregationCursor, MongoClient, Document, Filter } from 'mongodb'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  paginatePipeline,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongoDBUtils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'

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

  private getSanctionsSearchHistoryMongoPipeline(
    params: DefaultApiGetSanctionsSearchRequest
  ): Document[] {
    const conditions: Filter<SanctionsSearchHistory>[] = []
    conditions.push({
      createdAt: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })

    const filter = {
      $and: conditions,
    }

    const pipeline: Document[] = []

    pipeline.push({ $match: filter })
    pipeline.push({ $sort: { createdAt: -1 } })

    return pipeline
  }

  private getSanctionsSearchHistoryCursor(
    params: DefaultApiGetSanctionsSearchRequest
  ): AggregationCursor<SanctionsSearchHistory> {
    const pipeline = this.getSanctionsSearchHistoryMongoPipeline(params)
    pipeline.push({ $project: { response: 0 } })
    pipeline.push(...paginatePipeline(params))

    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    return collection.aggregate<SanctionsSearchHistory>(pipeline)
  }

  private async getSanctionsSearchCount(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    const pipeline = this.getSanctionsSearchHistoryMongoPipeline(params)

    pipeline.push({ $limit: COUNT_QUERY_LIMIT })
    pipeline.push({ $count: 'count' })

    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline)
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getSearchHistory(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    const cursor = this.getSanctionsSearchHistoryCursor(params)
    const total = this.getSanctionsSearchCount(params)
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
