import { MongoClient, Filter, UpdateFilter } from 'mongodb'
import { isNil, omitBy } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  prefixRegexMatchFilter,
  sendMessageToMongoUpdateConsumer,
} from '@/utils/mongodb-utils'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { cursorPaginate } from '@/utils/pagination'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { ProviderConfig } from '@/services/sanctions'
import { generateChecksum } from '@/utils/object'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { isLambdaFunction } from '@/utils/lambda'

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
    provider: SanctionsDataProviderName
    request: SanctionsSearchRequest
    response: SanctionsSearchResponse
    createdAt?: number
    updatedAt?: number
    searchedBy?: string
    hitContext: SanctionsHitContext | undefined
  }): Promise<void> {
    const { provider, request, response, createdAt, updatedAt } = props
    const filter: Filter<SanctionsSearchHistory> = { _id: response.searchId }
    const updateMessage: UpdateFilter<SanctionsSearchHistory> = {
      $set: {
        provider,
        request,
        response,
        createdAt: createdAt ?? Date.now(),
        updatedAt: updatedAt ?? Date.now(),
        ...(!request.monitoring?.enabled && {
          expiresAt: dayjs().add(DEFAULT_EXPIRY_TIME, 'hours').valueOf(),
        }),
        ...(props.searchedBy && { searchedBy: props.searchedBy }),
      },
    }

    if (envIs('local') || envIs('test')) {
      await this.updateMessageSync(filter, updateMessage)
      return
    }

    if (!isLambdaFunction()) {
      await this.updateMessageSync(filter, updateMessage)
      return
    }

    try {
      await sendMessageToMongoUpdateConsumer({
        filter: { _id: response.searchId },
        updateMessage,
        collectionName: SANCTIONS_SEARCHES_COLLECTION(this.tenantId),
        upsert: true,
        operationType: 'updateOne',
        sendToClickhouse: false,
      })
    } catch (e) {
      logger.error(
        `Failed to send message to mongo update consumer for sanctions search: ${e}`
      )

      await this.updateMessageSync(filter, updateMessage)
    }
  }

  private async updateMessageSync(
    filter: Filter<SanctionsSearchHistory>,
    updateMessage: UpdateFilter<SanctionsSearchHistory>
  ) {
    const collectionName = SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    await db
      .collection<SanctionsSearchHistory>(collectionName)
      .updateOne(filter, updateMessage, { upsert: true })
  }

  public async getSearchResultByParams(
    provider: SanctionsDataProviderName,
    request: SanctionsSearchRequest,
    providerConfig?: ProviderConfig
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const {
      _id,
      monitoring: _monitoring,
      monitored: _monitored,
      fuzzinessRange,
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

    if (fuzzinessRange != null) {
      filters.push({
        $or: [
          {
            'request.fuzzinessRange': { $eq: null },
          },
          {
            'request.fuzzinessRange': fuzzinessRange,
          },
        ],
      })
    }

    if (
      providerConfig &&
      (this.tenantId === '78c5a44b9b' ||
        this.tenantId === '8e0e970c86' ||
        this.tenantId.includes('flagright'))
    ) {
      filters.push({ providerConfigHash: generateChecksum(providerConfig) })
    }

    filters.push({
      provider,
    })

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
          'response.data.types': prefixRegexMatchFilter(
            toComplyAdvantageType(type)
          ),
        })),
      })
    }

    if (params.filterManualSearch) {
      conditions.push({
        searchedBy: { $exists: true },
      })
    }
    if (params.filterSearchedBy?.length) {
      conditions.push({
        searchedBy: { $in: params.filterSearchedBy },
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

  public async getSearchResultByProviderSearchId(
    provider: SanctionsDataProviderName,
    providerSearchId: string
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const searches = await collection
      .find({
        provider,
        'response.providerSearchId': providerSearchId,
      })
      .toArray()
    // if (searches.length > 1) {
    //   throw new Error(
    //     `Found more than 1 searches by CA id: ${caSearchId} (found ${searches.length})`
    //   )
    // }
    return searches[0]
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
