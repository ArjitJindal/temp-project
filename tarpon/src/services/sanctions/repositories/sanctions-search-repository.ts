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
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import dayjs from '@/utils/dayjs'

const DEFAULT_EXPIRY_TIME = 168 // hours

export class SanctionsSearchRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSearchResult(
    request: SanctionsSearchRequest,
    response: SanctionsSearchResponse,
    createdAt?: number,
    updatedAt?: number
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    await collection.replaceOne(
      { _id: response.searchId },
      {
        request,
        response,
        createdAt: createdAt ?? Date.now(),
        updatedAt: updatedAt ?? Date.now(),
        ...(!request.monitoring?.enabled && {
          expiresAt: dayjs().add(DEFAULT_EXPIRY_TIME, 'hours').valueOf(),
        }),
      },
      { upsert: true }
    )
  }

  public async getSearchResultByParams(
    request: SanctionsSearchRequest
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const {
      _id,
      monitoring: _monitoring,
      monitored: _monitored,
      ...params
    } = request

    const paramFilters = Object.entries(params).map(([k, v]) => {
      return { [`request.${k}`]: v }
    })

    const filters: Filter<SanctionsSearchHistory>[] = [
      ...paramFilters,
      { 'request.monitoring.enabled': request.monitoring?.enabled },
      ...(!request.monitoring?.enabled
        ? [{ expiresAt: { $exists: true, $gt: Date.now() } }]
        : []),
    ]

    return await collection.findOne({
      $and: filters,
    })
  }

  private getSanctionsSearchHistoryCondition(
    params: DefaultApiGetSanctionsSearchRequest
  ): Filter<SanctionsSearchHistory> {
    const conditions: Filter<SanctionsSearchHistory>[] = []
    conditions.push({
      createdAt: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })

    return { $and: conditions }
  }

  public async getNumberOfSearchesBetweenTimestamps(
    afterTimestamp: number,
    beforeTimestamp: number
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return await collection.countDocuments({
      createdAt: {
        $gte: afterTimestamp,
        $lt: beforeTimestamp,
      },
    })
  }

  private getSanctionsSearchHistoryMongoPipeline(
    params: DefaultApiGetSanctionsSearchRequest
  ): Document[] {
    const filter = this.getSanctionsSearchHistoryCondition(params)
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

    const conditions = this.getSanctionsSearchHistoryCondition(params)
    const count = await collection.countDocuments(conditions, {
      limit: COUNT_QUERY_LIMIT,
    })
    return count
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

  public async getSearchResultByCASearchId(
    caSearchId: number
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return await collection.findOne({
      'response.rawComplyAdvantageResponse.content.data.id': caSearchId,
    })
  }

  public async updateSearchMonitoring(
    searchId: string,
    monitoring: SanctionsSearchMonitoring
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { _id: searchId },
      { $set: { 'request.monitoring': monitoring } }
    )
  }
}
