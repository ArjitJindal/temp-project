import { AggregationCursor, MongoClient, Document, Filter } from 'mongodb'
import { isNil, omitBy } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { paginatePipeline, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import dayjs from '@/utils/dayjs'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { traceable } from '@/core/xray'
import { SanctionsSearchHistoryMetadata } from '@/@types/openapi-internal/SanctionsSearchHistoryMetadata'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'

const DEFAULT_EXPIRY_TIME = 168 // hours

function toComplyAdvantageType(type: SanctionsSearchType) {
  switch (type) {
    case 'SANCTIONS':
      return 'sanction'
    case 'PEP':
      return 'pep'
    case 'ADVERSE_MEDIA':
      return 'adverse-media'
  }
}

@traceable
export class SanctionsSearchRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveSearchResult(props: {
    request: SanctionsSearchRequest
    response: SanctionsSearchResponse
    createdAt?: number
    updatedAt?: number
    metadata?: SanctionsSearchHistoryMetadata
  }): Promise<void> {
    const { request, response, createdAt, updatedAt, metadata } = props
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    await collection.updateOne(
      { _id: response.searchId },
      {
        $set: {
          request,
          response,
          createdAt: createdAt ?? Date.now(),
          updatedAt: updatedAt ?? Date.now(), // Always set to the current time when updating
          ...(!request.monitoring?.enabled && {
            expiresAt: dayjs().add(DEFAULT_EXPIRY_TIME, 'hours').valueOf(),
          }),
          ...(metadata && {
            metadata,
          }),
        },
      },
      { upsert: true }
    )
  }

  public async saveSearchResultMetadata(props: {
    searchId: string
    metadata?: SanctionsSearchHistoryMetadata
  }): Promise<void> {
    const { searchId, metadata } = props
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    await collection.updateOne(
      { _id: searchId },
      {
        $set: {
          metadata: metadata,
        },
      }
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
      if (typeof v === 'object' && Array.isArray(v) && v.length > 0) {
        return { [`request.${k}`]: { $all: v, $size: v.length } }
      }
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
    const conditions: Filter<SanctionsSearchHistory>[] = [
      omitBy(
        {
          createdAt: {
            $gte: params.afterTimestamp || 0,
            $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
          },
          'request.searchTerm': params.searchTerm
            ? prefixRegexMatchFilter(params.searchTerm, true)
            : undefined,
        },
        isNil
      ),
    ]
    if (params.types && params.types.length > 0) {
      conditions.push({
        $or: params.types.map((type) => ({
          'response.data.doc.types': prefixRegexMatchFilter(
            toComplyAdvantageType(type)
          ),
        })),
      })
    }
    return { $and: conditions }
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

  public async getSearchResultByIds(
    searchIds: string[]
  ): Promise<SanctionsSearchHistory[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return collection.find({ _id: { $in: searchIds } }).toArray()
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

  private extractStats(stats, entityType) {
    const stat = stats.find((stat) => stat._id === entityType)
    const bankStat = stats.find((stat) => stat._id === 'IBAN')

    return stat
      ? {
          hitCount:
            entityType === 'BANK'
              ? stat.hitCount + (bankStat?.hitCount ?? 0)
              : stat.hitCount,
          screenedCount:
            entityType === 'BANK'
              ? stat.screenedCount + (bankStat?.screenedCount ?? 0)
              : stat.screenedCount,
        }
      : {
          hitCount: 0,
          screenedCount: 0,
        }
  }

  public async getSanctionsScreeningStats(): Promise<SanctionsScreeningStats> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const result = await collection
      .aggregate([
        {
          $match: {
            metadata: { $exists: true },
          },
        },
        {
          $group: {
            _id: '$metadata.entity',
            hitCount: {
              $sum: {
                $cond: {
                  if: { $gt: [{ $size: '$response.data' }, 0] },
                  then: 1,
                  else: 0,
                },
              },
            },
            screenedCount: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const user = this.extractStats(result, 'USER')
    const counterPartyUser = this.extractStats(result, 'EXTERNAL_USER')
    const iban = this.extractStats(result, 'IBAN')
    const bank = this.extractStats(result, 'BANK')

    return {
      user,
      bank,
      iban,
      counterPartyUser,
    }
  }
}
