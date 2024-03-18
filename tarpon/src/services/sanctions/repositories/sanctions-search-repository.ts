import { MongoClient, Filter } from 'mongodb'
import { isNil, omitBy } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { cursorPaginate } from '@/utils/pagination'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import dayjs from '@/utils/dayjs'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { traceable } from '@/core/xray'

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
  }): Promise<void> {
    const { request, response, createdAt, updatedAt } = props
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
        },
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

  private getSanctionsSearchHistoryCursorPaginate(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    return cursorPaginate(
      collection,
      this.getSanctionsSearchHistoryCondition(params),
      {
        pageSize: params.pageSize ? (params.pageSize as number) : 20,
        sortField: 'createdAt',
        fromCursorKey: params.start,
        sortOrder: 'descend',
      }
    )
  }

  public async getSearchHistory(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    const result = await this.getSanctionsSearchHistoryCursorPaginate(params)
    const items = result.items.map((item) => ({
      ...item,
      response: undefined, //response has no use in front end, thus omited the extra payload from request's response
    }))
    return {
      ...result,
      items,
    }
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
}
