import { MongoClient, Filter, UpdateFilter } from 'mongodb'
import { intersection, isNil, omit, omitBy } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
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
import { generateChecksum, getSortedObject } from '@/utils/object'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { getTriggerSource } from '@/utils/lambda'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { getContext } from '@/core/utils/context-storage'

const DEFAULT_EXPIRY_TIME = 168 // hours

function toComplyAdvantageType(type: SanctionsSearchType) {
  switch (type) {
    case 'SANCTIONS':
      return 'sanction'
    case 'PEP':
      return 'pep'
    case 'ADVERSE_MEDIA':
      return 'adverse-media'
    case 'WARNINGS':
      return 'warning'
  }
}

@traceable
export class SanctionsSearchRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  public async saveSearchResult(props: {
    provider: SanctionsDataProviderName
    request: SanctionsSearchRequest
    response: SanctionsSearchResponse
    createdAt?: number
    updatedAt?: number
    searchedBy?: string
    hitContext: SanctionsHitContext | undefined
    providerConfigHash?: string
    requestHash?: string
    screeningEntity?: 'USER' | 'TRANSACTION'
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
        ...(props.providerConfigHash && {
          providerConfigHash: props.providerConfigHash,
        }),
        ...(props.requestHash && { requestHash: props.requestHash }),
      },
    }

    if (props.screeningEntity) {
      updateMessage.$addToSet = {
        'metadata.screeningEntity': props.screeningEntity,
      }
    }

    if (
      envIs('local', 'test') ||
      getTriggerSource() !== 'PUBLIC_API' ||
      provider === 'comply-advantage'
    ) {
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
      logger.warn(
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
    const sanctions = getContext()?.settings?.sanctions
    const hasInitialScreeningProfile = !!sanctions?.customInitialSearchProfileId
    const {
      monitoring: _monitoring,
      monitored: _monitored,
      fuzzinessRange,
      fuzziness,
    } = request

    const requestHash = generateChecksum(
      getSortedObject(omit(request, ['fuzzinessRange', 'fuzziness']))
    )

    const filters: Filter<SanctionsSearchHistory>[] = [
      { 'request.monitoring.enabled': request.monitoring?.enabled },
      ...(!request.monitoring?.enabled
        ? [{ expiresAt: { $exists: true, $gt: Date.now() } }]
        : []),
      { 'request.fuzziness': fuzziness },
      { requestHash: requestHash },
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

    if (providerConfig && providerConfig.stage && hasInitialScreeningProfile) {
      filters.push({
        providerConfigHash: generateChecksum({
          ...providerConfig,
          stage: providerConfig.stage === 'INITIAL' ? 'INITIAL' : 'ONGOING',
        }),
      })
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
      const searchTypes = intersection(
        params.types,
        SANCTIONS_SEARCH_TYPES
      ) as SanctionsSearchType[]
      conditions.push({
        $or: searchTypes.map((type) => ({
          'response.data.types': prefixRegexMatchFilter(
            toComplyAdvantageType(type)
          ),
        })),
      })
    }

    if (params.filterManualSearch) {
      conditions.push({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        searchedBy: { $ne: null },
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

  public async getSearchResultPaginated(
    searchId: string,
    page: number,
    pageSize: number
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    const startIndex = (page - 1) * pageSize

    const aggregationPipeline = [
      { $match: { _id: searchId } },
      {
        $addFields: {
          totalHits: { $size: { $ifNull: ['$response.data', []] } },
        },
      },
      {
        $project: {
          response: {
            data: { $slice: ['$response.data', startIndex, pageSize] },
            page: { $literal: page },
            pageSize: { $literal: pageSize },
            totalPages: { $ceil: { $divide: ['$totalHits', pageSize] } },
            hitsCount: '$totalHits',
            providerSearchId: 1,
            createdAt: 1,
            searchId: 1,
          },
          requestHash: 1,
          request: 1,
          provider: 1,
          createdAt: 1,
          updatedAt: 1,
          _id: 1,
        },
      },
    ]

    const results = await collection
      .aggregate<SanctionsSearchHistory>(aggregationPipeline)
      .toArray()
    return results[0] || null
  }

  public async getSearchResult(
    searchId: string
  ): Promise<SanctionsSearchHistory | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ _id: searchId })
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
