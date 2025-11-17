import { MongoClient, Filter, UpdateFilter, Document } from 'mongodb'
import isNil from 'lodash/isNil'
import omitBy from 'lodash/omitBy'
import { Search_Response } from '@opensearch-project/opensearch/api'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import padStart from 'lodash/padStart'
import { getDefaultProviders } from '../utils'
import {
  deriveMatchingDetails,
  getCollectionNames,
  getSanctionSourceDetails,
  hydrateHitsWithMatchTypes,
  sanitizeEntities,
} from '../providers/utils'
import { OPENSEARCH_NON_PROJECTED_FIELDS } from '../providers/sanctions-data-fetcher'
import {
  ProviderConfig,
  SanctionsDataProviders,
  SanctionsSearchProps,
} from '../types'
import { LSEGAPIDataProvider } from '../providers/lseg-api-provider'
import {
  getMongoDbClient,
  prefixRegexMatchFilter,
  sendMessageToMongoUpdateConsumer,
} from '@/utils/mongodb-utils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  SANCTIONS_BULK_SEARCHES_HISTORY_COLLECTION,
  SANCTIONS_BULK_SEARCHES_RESULT_MAP_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongo-table-names'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import {
  cursorPaginate,
  cursorPaginateAggregate,
  AggregateSortField,
} from '@/utils/pagination'
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { CursorPaginationResponse } from '@/@types/pagination'
import { traceable } from '@/core/xray'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { generateChecksum } from '@/utils/object'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { getTriggerSource } from '@/utils/lambda'
import { hasFeature } from '@/core/utils/context'
import { getSharedOpensearchClient } from '@/utils/opensearch-utils'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { ScreeningProfileService } from '@/services/screening-profile'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsBulkSearchHistory } from '@/@types/openapi-internal/SanctionsBulkSearchHistory'
import { SanctionsBulkSearchResultMap } from '@/@types/openapi-internal/SanctionsBulkSearchResultMap'
import { getContext } from '@/core/utils/context-storage'
import { SanctionsBulkSearchResponse } from '@/@types/openapi-internal/SanctionsBulkSearchResponse'
import { SearchTypeHistory } from '@/@types/openapi-internal/SearchTypeHistory'

@traceable
export class SanctionsSearchRepository {
  tenantId: string
  mongoDb?: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tableName: string

  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }
  private async getMongoDbClient() {
    return this.mongoDb ?? (await getMongoDbClient())
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
    dynamoHash?: string
    screeningEntity?: 'USER' | 'TRANSACTION'
    batchId?: string
    screeningType?: 'SEARCH' | 'BATCH'
    searchTermId?: string
  }): Promise<void> {
    const {
      provider,
      request,
      response,
      createdAt,
      updatedAt,
      batchId,
      screeningType,
      searchTermId,
    } = props
    const filter: Filter<SanctionsSearchHistory> = { _id: response.searchId }
    const updateMessage: UpdateFilter<SanctionsSearchHistory> = {
      $set: {
        provider,
        request,
        response,
        createdAt: createdAt ?? Date.now(),
        updatedAt: updatedAt ?? Date.now(),
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
    if (batchId || screeningType || searchTermId) {
      const historyEntry: SearchTypeHistory = {
        ...(screeningType && { screeningType }),
        ...(batchId && { batchId }),
        ...(searchTermId && { searchTermId }),
        searchedAt: Date.now(),
      }
      updateMessage.$push = {
        ...updateMessage.$push,
        history: historyEntry,
      }
    }
    if (props.dynamoHash) {
      await this.storeSearchResultInDynamoDB(
        props.dynamoHash,
        updateMessage,
        filter
      )
    }
    if (envIs('local', 'test') || getTriggerSource() !== 'PUBLIC_API') {
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
    const db = (await this.getMongoDbClient()).db()
    await db
      .collection<SanctionsSearchHistory>(collectionName)
      .updateOne(filter, updateMessage, { upsert: true })
  }

  private async storeSearchResultInDynamoDB(
    dynamoHash: string,
    updateMessage: UpdateFilter<SanctionsSearchHistory>,
    filter: Filter<SanctionsSearchHistory>
  ): Promise<void> {
    const key = DynamoDbKeys.SANCTION_SEARCHES(this.tenantId, dynamoHash)

    const response = updateMessage.$set?.response
    const searchId = filter._id

    if (response && searchId) {
      const simplifiedResponse = {
        ...response,
        data: response.data?.map((entity) => ({
          entityId: entity.id,
          entityType: entity.entityType,
        })),
      }

      const dynamoItem = {
        ...key,
        ...updateMessage.$set,
        searchId,
        response: simplifiedResponse,
      }

      const putCommand = new PutCommand({
        TableName: this.tableName,
        Item: dynamoItem,
      })

      await this.dynamoDb.send(putCommand)
    }
  }

  public async saveBulkSearchRequest(
    request: SanctionsSearchRequest,
    reason: string
  ): Promise<string> {
    const db = (await this.getMongoDbClient()).db()
    // Generate a new sequential counter specific to sanctions bulk searches
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: await this.getMongoDbClient(),
      dynamoDb: this.dynamoDb,
    })
    const counter = await counterRepository.getNextCounterAndUpdate(
      'SanctionsBulkSearch'
    )
    const batchId = `BS-${padStart(counter.toString(), 3, '0')}`
    const now = Date.now()
    await db
      .collection<SanctionsBulkSearchHistory>(
        SANCTIONS_BULK_SEARCHES_HISTORY_COLLECTION(this.tenantId)
      )
      .insertOne({
        batchId: batchId,
        request: request,
        reason: reason,
        createdBy: getContext()?.user?.id,
        createdAt: now,
        updatedAt: now,
      })
    return batchId
  }

  public async getBulkSearchHistory(
    batchId: string
  ): Promise<SanctionsBulkSearchHistory | null> {
    const db = (await this.getMongoDbClient()).db()
    return db
      .collection<SanctionsBulkSearchHistory>(
        SANCTIONS_BULK_SEARCHES_HISTORY_COLLECTION(this.tenantId)
      )
      .findOne({ batchId })
  }

  public async getBulkSearchHistories(
    batchIds: string[]
  ): Promise<SanctionsBulkSearchHistory[]> {
    const db = (await this.getMongoDbClient()).db()
    return db
      .collection<SanctionsBulkSearchHistory>(
        SANCTIONS_BULK_SEARCHES_HISTORY_COLLECTION(this.tenantId)
      )
      .find({ batchId: { $in: batchIds } })
      .toArray()
  }
  public async saveBulkSearchResultMap(
    batchId: string,
    searchId: string,
    searchTermId: string,
    searchTerm: string
  ): Promise<void> {
    const db = (await this.getMongoDbClient()).db()
    await db
      .collection<SanctionsBulkSearchResultMap>(
        SANCTIONS_BULK_SEARCHES_RESULT_MAP_COLLECTION(this.tenantId)
      )
      .insertOne({
        batchId,
        searchId,
        searchTermId,
        searchTerm,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
  }
  public async getBulkSearchResultMap(
    searchTermId: string
  ): Promise<SanctionsBulkSearchResultMap | null> {
    const db = (await this.getMongoDbClient()).db()
    return db
      .collection<SanctionsBulkSearchResultMap>(
        SANCTIONS_BULK_SEARCHES_RESULT_MAP_COLLECTION(this.tenantId)
      )
      .findOne(
        { searchTermId },
        { projection: { searchTermId: 1, searchId: 1 } }
      )
  }

  public async getBulkSearchesWithSearchTerms(params: {
    pageSize?: number
    fromCursorKey?: string
    sortOrder?: 'ascend' | 'descend'
    batchId?: string
  }): Promise<CursorPaginationResponse<SanctionsBulkSearchResponse>> {
    const db = (await this.getMongoDbClient()).db()
    const resultMapCollection = db.collection<SanctionsBulkSearchResultMap>(
      SANCTIONS_BULK_SEARCHES_RESULT_MAP_COLLECTION(this.tenantId)
    )

    // Primary call: paginate directly on RESULT_MAP collection
    const resultMapFilter: Filter<SanctionsBulkSearchResultMap> = params.batchId
      ? { batchId: params.batchId }
      : {}
    const resultMapPaginated = await cursorPaginate(
      resultMapCollection,
      resultMapFilter,
      {
        pageSize: params.pageSize ?? 20,
        sortField: 'createdAt',
        fromCursorKey: params.fromCursorKey,
        sortOrder: params.sortOrder ?? 'descend',
      }
    )

    // Get unique batchIds from paginated results
    const batchIds = [
      ...new Set(resultMapPaginated.items.map((item) => item.batchId)),
    ]

    // Fetch reason and createdBy from HISTORY collection for these batchIds
    const historyDocs = (await this.getBulkSearchHistories(
      batchIds
    )) as SanctionsBulkSearchHistory[]

    // Create a map for quick lookup
    const historyMap = new Map(historyDocs.map((doc) => [doc.batchId, doc]))

    // Stitch together: result map data + history data
    const stitchedResults: SanctionsBulkSearchResponse[] =
      resultMapPaginated.items.map((item) => {
        const history = historyMap.get(item.batchId)
        const response = new SanctionsBulkSearchResponse()
        response.searchTermId = item.searchTermId
        response.searchTerm = item.searchTerm
        response.reason = history?.reason ?? ''
        response.createdBy = history?.createdBy
        response.createdAt = item.createdAt
        return response
      })

    return {
      ...resultMapPaginated,
      items: stitchedResults,
      pageSize: params.pageSize ?? 20,
    }
  }
  public async getSearchResultByParams(params: {
    provider: SanctionsDataProviderName
    request: SanctionsSearchRequest
    mongoHash: string
    dynamoHash: string
    isBackfillDone: boolean
    providerConfig?: ProviderConfig
    fetchResponse?: boolean
  }): Promise<SanctionsSearchResponse | null> {
    const {
      provider,
      request,
      mongoHash,
      dynamoHash,
      isBackfillDone,
      providerConfig,
      fetchResponse = false,
    } = params
    if (isBackfillDone && !hasFeature('LSEG_API')) {
      const key = DynamoDbKeys.SANCTION_SEARCHES(this.tenantId, dynamoHash)
      const command = new GetCommand({
        TableName: this.tableName,
        Key: key,
        ...(fetchResponse
          ? {
              ProjectionExpression: '#response',
              ExpressionAttributeNames: { '#response': 'response' },
            }
          : {
              ProjectionExpression: '#searchId',
              ExpressionAttributeNames: { '#searchId': 'searchId' },
            }),
      })
      const result = await this.dynamoDb.send(command)
      return fetchResponse
        ? (result.Item?.response as SanctionsSearchResponse | null)
        : ({
            searchId: result.Item?.searchId,
          } as SanctionsSearchResponse | null)
    }
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const {
      monitoring: _monitoring,
      monitored: _monitored,
      fuzzinessRange,
      fuzziness,
    } = request

    const filters: Filter<SanctionsSearchHistory>[] = [
      { 'request.monitoring.enabled': request.monitoring?.enabled },
      { 'request.fuzziness': fuzziness },
      { requestHash: mongoHash },
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

    if (providerConfig && providerConfig.stage) {
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

    const result = await collection.findOne(
      { $and: filters },
      {
        projection: {
          _id: 1,
          ...(fetchResponse ? { response: 1 } : {}),
        },
      }
    )
    return fetchResponse
      ? (result?.response as SanctionsSearchResponse | null)
      : ({
          searchId: result?._id,
        } as SanctionsSearchResponse | null)
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

  private async getSanctionsSearchHistoryCursorPaginate(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )

    const basePipeline: Document[] = [
      { $match: this.getSanctionsSearchHistoryCondition(params) },
      {
        $unwind: {
          path: '$history',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          screeningType: '$history.screeningType',
          batchId: '$history.batchId',
          searchTermId: '$history.searchTermId',
          searchedAt: '$history.searchedAt',
        },
      },
    ]

    const sort: AggregateSortField[] = [
      { field: 'createdAt', direction: -1, type: 'number' },
      { field: '_id', direction: -1, type: 'objectId' },
      { field: 'searchedAt', direction: -1, type: 'number' },
    ]
    const pageSize = params.pageSize
      ? Math.min(params.pageSize as number, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

    return cursorPaginateAggregate(collection, basePipeline, {
      pageSize,
      fromCursorKey: params.start,
      sort,
      // Exclude large fields that aren't needed in the response
      // 'response' is set to undefined in getSearchHistory anyway
      // 'history' is already unwound and flattened into individual fields
      projection: { history: 0, response: 0 },
    })
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
    const db = (await this.getMongoDbClient()).db()
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

  private async getSanctionSourceDetailsInternal(
    request: SanctionsSearchRequest
  ): Promise<SanctionsSearchProps> {
    const screeningProfileService = new ScreeningProfileService(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    return getSanctionSourceDetails(request, screeningProfileService)
  }

  private async getSearchResultFromOpensearch(
    result: SanctionsSearchHistory
  ): Promise<SanctionsSearchHistory | null> {
    const { response, request } = result
    if (!response?.data?.length) {
      return result
    }
    const entityIds = response.data
      .filter((entity) => entity.name == null)
      .map((entity) => entity.id)
    if (!entityIds.length) {
      return result
    }
    const opensearchClient = await getSharedOpensearchClient()
    const collectionNames = getCollectionNames(
      result.request,
      getDefaultProviders(),
      this.tenantId
    )
    const results = await Promise.allSettled(
      collectionNames.map(async (collectionName) => {
        return opensearchClient.search({
          index: collectionName,
          _source: SanctionsEntity.attributeTypeMap
            .map((a) => a.name)
            .filter((a) => !OPENSEARCH_NON_PROJECTED_FIELDS.includes(a)),
          size: entityIds.length,
          body: {
            query: {
              bool: {
                must: [
                  {
                    terms: {
                      id: entityIds,
                    },
                  },
                ],
              },
            },
          },
        })
      })
    )
    if (results.some((r) => r.status === 'rejected')) {
      logger.error(
        `Error in opensearch search: ${JSON.stringify(
          results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r) => r.reason)
        )}`
      )
    }
    const hits = results
      .filter(
        (r): r is PromiseFulfilledResult<Search_Response> =>
          r.status === 'fulfilled'
      )
      .map((r) => r.value)
      .flatMap((r) =>
        r.body.hits.hits.map((h) => h._source)
      ) as SanctionsEntity[]
    const sanctionSourceDetails = await this.getSanctionSourceDetailsInternal(
      request
    )
    const updatedHits = await sanitizeEntities({
      data: hydrateHitsWithMatchTypes(hits, request).map((entity) => ({
        ...entity,
        matchTypeDetails: [deriveMatchingDetails(request, entity)],
      })),
      ...sanctionSourceDetails,
    })
    const updatedResponse: SanctionsSearchResponse = {
      ...result.response,
      data: result.response?.data?.map((entity) => {
        const entityFromOpensearch = updatedHits?.find(
          (e) => e.id === entity.id && e.entityType === entity.entityType
        )
        return {
          ...entity,
          ...entityFromOpensearch,
        }
      }),
      searchId: result._id,
    } as SanctionsSearchResponse
    await (
      await this.getMongoDbClient()
    )
      .db()
      .collection<SanctionsSearchHistory>(
        SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
      )
      .updateOne({ _id: result._id }, { $set: { response: updatedResponse } })
    return {
      ...result,
      response: updatedResponse,
    }
  }

  public async hydrateLSEGApiSearchResults(
    sanctionsSearch: SanctionsSearchHistory | null
  ): Promise<SanctionsSearchHistory | null> {
    if (!hasFeature('LSEG_API')) {
      return sanctionsSearch
    }

    if (!sanctionsSearch || !sanctionsSearch.response?.isNewSearch) {
      return sanctionsSearch
    }
    const collection = (await this.getMongoDbClient())
      .db()
      .collection<SanctionsSearchHistory>(
        SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
      )
    const lsegApiProvider = await LSEGAPIDataProvider.build(this.tenantId)
    const targetRecords = sanctionsSearch.response?.data?.filter(
      (entity) => entity.provider === SanctionsDataProviders.LSEG_API
    )
    if (!targetRecords?.length) {
      return sanctionsSearch
    }
    const hydratedRecords = await lsegApiProvider.hydrateSearchResults(
      targetRecords
    )
    const updatedResponse: SanctionsSearchResponse = {
      ...sanctionsSearch.response,
      data: [
        ...(sanctionsSearch.response?.data ?? []).filter(
          (entity) => entity.provider !== SanctionsDataProviders.LSEG_API
        ),
        ...hydratedRecords,
      ],
      isNewSearch: false,
    }
    await collection.updateOne(
      { _id: sanctionsSearch._id },
      { $set: { response: updatedResponse } }
    )
    return {
      ...sanctionsSearch,
      response: updatedResponse,
    }
  }

  public async getSearchResult(
    searchId: string
  ): Promise<SanctionsSearchHistory | null> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    const result = await collection.findOne({ _id: searchId })
    if (!result) {
      return null
    }
    if (hasFeature('OPEN_SEARCH') && result.response?.data?.length) {
      const isResultComplete = result.response.data?.every(
        (entity) => entity.name != null
      )
      if (isResultComplete) {
        return result
      }
      return await this.getSearchResultFromOpensearch(result)
    }
    return result
  }

  public async getSearchResultByIds(
    searchIds: string[]
  ): Promise<SanctionsSearchHistory[]> {
    const db = (await this.getMongoDbClient()).db()
    const collection = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
    )
    return collection.find({ _id: { $in: searchIds } }).toArray()
  }

  public async getSearchResultByProviderSearchId(
    provider: SanctionsDataProviderName,
    providerSearchId: string
  ): Promise<SanctionsSearchHistory | null> {
    const db = (await this.getMongoDbClient()).db()
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
}
