import { v4 as uuidv4 } from 'uuid'
import intersection from 'lodash/intersection'
import omit from 'lodash/omit'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import compact from 'lodash/compact'
import dayjs from '@flagright/lib/utils/dayjs'
import {
  getSourceUrl,
  isLatinScript,
  normalize,
  sanitizeString,
} from '@flagright/lib/utils'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { Client } from '@opensearch-project/opensearch/.'
import { StackConstants } from '@lib/constants'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsWhitelistEntityRepository } from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsScreeningDetailsRepository } from './repositories/sanctions-screening-details-repository'
import { AcurisProvider } from './providers/acuris-provider'
import { MongoSanctionSourcesRepository } from './repositories/sanction-source-repository'
import { LSEGProvider } from './providers/lseg-provider'
import { LSEGAPIDataProvider } from './providers/lseg-api-provider'
import { SanctionsDataProviders, ProviderConfig } from './types'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DefaultApiGetAcurisCopywritedSourceDownloadUrlRequest,
  DefaultApiGetMediaCheckArticlesRequest,
  DefaultApiGetSanctionsScreeningActivityDetailsRequest,
  DefaultApiGetSanctionsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { traceable } from '@/core/xray'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/@types/pagination'
import {
  GenericSanctionsSearchType,
  SanctionsDataProviderName,
  SanctionsHit,
  SanctionsSearchResponse,
  SanctionsSourceListResponse,
  SourceDocument,
  MediaCheckArticleResponse,
  MediaCheckArticleResponseItem,
} from '@/@types/openapi-internal/all'
import { SanctionsDataProvider } from '@/services/sanctions/providers/types'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import {
  DEFAULT_PROVIDER_TYEPS_MAP,
  getDefaultProviders,
  getSanctionsSourceDocumentsCollectionName,
} from '@/services/sanctions/utils'
import { SanctionsListProvider } from '@/services/sanctions/providers/sanctions-list-provider'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { logger } from '@/core/logger'
import { CaseConfig } from '@/@types/cases/case-config'
import { getSecretByName } from '@/utils/secrets-manager'
import { DOW_JONES_ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/DowJonesAdverseMediaSourceRelevance'
import { DOW_JONES_PEP_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/DowJonesPEPSourceRelevance'
import { PEP_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/PEPSourceRelevance'
import { ADVERSE_MEDIA_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/AdverseMediaSourceRelevance'
import { SANCTIONS_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/SanctionsSourceRelevance'
import { REL_SOURCE_RELEVANCES } from '@/@types/openapi-internal-custom/RELSourceRelevance'
import { getSharedOpensearchClient } from '@/utils/opensearch-utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { LSEG_API_MEDIA_CHECK_RESULT_COLLECTION } from '@/utils/mongo-table-names'
import { cursorPaginate } from '@/utils/pagination'

const DEFAULT_FUZZINESS = 0.5

@traceable
export class SanctionsService {
  sanctionsSearchRepository!: SanctionsSearchRepository
  sanctionsHitsRepository!: SanctionsHitsRepository
  sanctionsWhitelistEntityRepository!: SanctionsWhitelistEntityRepository
  tenantId: string
  initializationPromise: Promise<void> | null = null
  mongoDb?: MongoClient
  dynamoDb: DynamoDBDocumentClient
  opensearchClient?: Client

  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
      dynamoDb: DynamoDBDocumentClient
      opensearchClient?: Client
    }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.opensearchClient = connections.opensearchClient
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      })
    this.sanctionsHitsRepository = new SanctionsHitsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
  }

  private async getMongoDbClient() {
    return this.mongoDb ?? (await getMongoDbClient())
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const opensearchClient = hasFeature('OPEN_SEARCH')
      ? await getSharedOpensearchClient()
      : undefined
    const sanctionsService = new SanctionsService(tenantId, {
      mongoDb,
      dynamoDb,
      opensearchClient,
    })
    return sanctionsService
  }

  private async getProvider(
    provider: SanctionsDataProviderName,
    connections: {
      dynamoDb: DynamoDBDocumentClient
      opensearchClient?: Client
    },
    providerConfig?: ProviderConfig
  ): Promise<SanctionsDataProvider> {
    switch (provider) {
      case 'dowjones':
        return await DowJonesProvider.build(this.tenantId, connections)
      case 'open-sanctions':
        return OpenSanctionsProvider.build(this.tenantId, connections)
      case 'acuris':
        return AcurisProvider.build(this.tenantId, connections)
      case 'lseg':
        return LSEGProvider.build(this.tenantId, connections)
      case 'list':
        if (!providerConfig?.listId) {
          throw new Error(`No list ID given for list sanctions provider`)
        }
        return await SanctionsListProvider.build(
          this.tenantId,
          providerConfig.listId,
          connections
        )
      case 'lseg-api':
        return LSEGAPIDataProvider.build(this.tenantId)
    }
  }

  public async refreshSearch(
    providerSearchId: string,
    providerName: SanctionsDataProviderName
  ): Promise<boolean> {
    if (!this.opensearchClient && hasFeature('OPEN_SEARCH')) {
      this.opensearchClient = await getSharedOpensearchClient()
    }
    const result =
      await this.sanctionsSearchRepository.getSearchResultByProviderSearchId(
        providerName,
        providerSearchId
      )
    if (!result) {
      return false
    }
    const provider = await this.getProvider(providerName, {
      dynamoDb: this.dynamoDb,
      opensearchClient: this.opensearchClient,
    })
    const response = await provider.getSearch(providerSearchId)

    await this.sanctionsHitsRepository.addNewHits(
      providerName,
      result._id,
      response.data || [],
      result.hitContext
    )

    const parsedResponse = {
      hitsCount: response.data?.length ?? 0,
      searchId: result._id,
      providerSearchId: response.providerSearchId,
      createdAt: Date.now(),
      data: response.data ?? [],
    }
    await this.sanctionsSearchRepository.saveSearchResult({
      provider: providerName,
      request: result.request,
      response: parsedResponse,
      createdAt: result.createdAt,
      updatedAt: Date.now(),
      hitContext: result.hitContext,
      providerConfigHash: result.providerConfigHash,
      requestHash: result.requestHash,
    })

    logger.debug(
      `Updated monitored search (search ID: ${providerSearchId}) for tenant ${this.tenantId}`
    )

    return true
  }

  private getSanctionsSearchType(
    types: GenericSanctionsSearchType[] | undefined,
    providers: SanctionsDataProviderName[]
  ): GenericSanctionsSearchType[] {
    const providerScreeningTypes =
      getContext()?.settings?.sanctions?.providerScreeningTypes
    return compact(
      intersection(
        uniq(
          providers.flatMap((p) => {
            const providerSettings = providerScreeningTypes?.find(
              (t) => t.provider === p
            )
            return (providerSettings?.screeningTypes ??
              DEFAULT_PROVIDER_TYEPS_MAP[p]) as GenericSanctionsSearchType[]
          })
        ),
        types ?? uniq(providers.flatMap((p) => DEFAULT_PROVIDER_TYEPS_MAP[p]))
      )
    )
  }

  private isSearchTermInvalid(searchTerm: string): boolean {
    if (!searchTerm) {
      return true
    }
    if (
      hasFeature('TRANSLITERATION') &&
      !isLatinScript(normalize(searchTerm))
    ) {
      return false
    }
    if (!sanitizeString(searchTerm)) {
      return true
    }
    return false
  }

  private isYearOfBirthInvalid(yearOfBirth: number | undefined): boolean {
    return !!yearOfBirth && (yearOfBirth < 1900 || yearOfBirth > dayjs().year())
  }

  private isYearOfBirthRangeInvalid(
    yearOfBirthRange: { minYear?: number; maxYear?: number } | undefined
  ): boolean {
    if (!yearOfBirthRange) {
      return false
    }
    const currentYear = dayjs().year()
    const { minYear, maxYear } = yearOfBirthRange
    if (minYear && (minYear < 1900 || minYear > currentYear)) {
      return true
    }
    if (maxYear && (maxYear < 1900 || maxYear > currentYear)) {
      return true
    }
    if (minYear && maxYear && minYear > maxYear) {
      return true
    }
    return false
  }

  private async getBackfillStatus(): Promise<boolean> {
    const key = DynamoDbKeys.SANCTIONS_SEARCH_BATCH_JOB_STATUS(this.tenantId)
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })
    const result = await this.dynamoDb.send(command)
    return result.Item?.isBackfillDone === true
  }

  public async search(
    request: SanctionsSearchRequest,
    context?: SanctionsHitContext & {
      isOngoingScreening?: boolean
    },
    providerOverrides?: ProviderConfig,
    screeningEntity: 'USER' | 'TRANSACTION' = 'USER'
  ): Promise<SanctionsSearchResponse> {
    if (!this.opensearchClient && hasFeature('OPEN_SEARCH')) {
      this.opensearchClient = await getSharedOpensearchClient()
    }
    const page = request.page ?? 1
    const pageSize = request.pageSize ?? 20

    if (page < 1 || pageSize < 1) {
      return {
        providerSearchId: 'invalid_search',
        data: [],
        hitsCount: 0,
        searchId: 'invalid_search',
        createdAt: Date.now(),
      }
    }

    const providers = getDefaultProviders()
    const providerName = providerOverrides?.providerName || providers[0]

    if (
      this.isSearchTermInvalid(request.searchTerm) ||
      !providerName ||
      this.isYearOfBirthInvalid(request.yearOfBirth) ||
      this.isYearOfBirthRangeInvalid(request.yearOfBirthRange)
    ) {
      return {
        providerSearchId: 'invalid_search',
        data: [],
        hitsCount: 0,
        searchId: 'invalid_search',
        createdAt: Date.now(),
      }
    }

    request.fuzziness = this.getSanitizedFuzziness(request.fuzziness)
    request.types = this.getSanctionsSearchType(request.types, providers)
    const createdAt: number | undefined = undefined

    const provider = await this.getProvider(
      providerName,
      {
        dynamoDb: this.dynamoDb,
        opensearchClient: this.opensearchClient,
      },
      providerOverrides
    )

    const mongoHash = generateChecksum(
      getSortedObject(
        omit(request, ['fuzzinessRange', 'fuzziness', 'lsegMediaCheck'])
      )
    )
    const isBackfillDone = await this.getBackfillStatus()
    const dynamoHash = generateChecksum(
      getSortedObject(omit(request, ['lsegMediaCheck']))
    )

    const lsegApiProvider: LSEGAPIDataProvider | undefined =
      hasFeature('LSEG_API') && request.lsegMediaCheck?.enabled
        ? ((await this.getProvider(SanctionsDataProviders.LSEG_API, {
            dynamoDb: this.dynamoDb,
            opensearchClient: this.opensearchClient,
          })) as LSEGAPIDataProvider)
        : undefined

    const [
      sanctionsSearchResponse,
      historySearchResponse,
      lsegApiSearchResponse,
    ] = await Promise.all([
      provider.search(request),
      !lsegApiProvider
        ? this.sanctionsSearchRepository.getSearchResultByParams({
            provider: providerName,
            request,
            mongoHash,
            dynamoHash,
            isBackfillDone,
            providerConfig: providerOverrides,
          })
        : Promise.resolve(null),
      lsegApiProvider &&
        lsegApiProvider.startSearch(
          {
            provider: providerName,
            request,
            mongoHash,
            dynamoHash,
            isBackfillDone,
            providerConfig: providerOverrides,
          },
          this.sanctionsSearchRepository
        ),
    ])
    const searchId =
      (lsegApiProvider
        ? lsegApiSearchResponse?.searchId
        : historySearchResponse?.searchId) ?? uuidv4()
    const providerSearchId = sanctionsSearchResponse.providerSearchId
    const hits = [
      ...(sanctionsSearchResponse.data ?? []),
      ...(lsegApiSearchResponse?.data ?? []),
    ]
    const filteredHits =
      await this.sanctionsHitsRepository.filterWhitelistedHits(
        hits,
        context,
        providerName
      )

    const response: SanctionsSearchResponse = {
      searchId,
      data: filteredHits,
      hitsCount: filteredHits.length,
      providerSearchId: providerSearchId,
      createdAt: createdAt ?? Date.now(),
      providerReferenceIds: lsegApiProvider
        ? lsegApiSearchResponse?.providerReferenceIds
        : historySearchResponse?.providerReferenceIds,
    }

    await this.sanctionsSearchRepository.saveSearchResult({
      provider: providerName,
      createdAt: createdAt,
      request,
      requestHash: generateChecksum(
        getSortedObject(omit(request, ['fuzzinessRange', 'fuzziness']))
      ),
      dynamoHash,
      response,
      searchedBy: !context ? getContext()?.user?.id : undefined,
      hitContext: context,
      providerConfigHash:
        providerOverrides && providerOverrides.stage && !hasFeature('DOW_JONES')
          ? generateChecksum({
              ...providerOverrides,
              stage:
                providerOverrides.stage === 'INITIAL' ? 'INITIAL' : 'ONGOING',
            })
          : undefined,
      ...(context?.ruleInstanceId
        ? {
            screeningEntity,
          }
        : {}),
    })

    if (context && context.ruleInstanceId && context.isOngoingScreening) {
      // Save the screening details check when running a rule
      const details: Omit<SanctionsScreeningDetails, 'lastScreenedAt'> = {
        name: request.searchTerm,
        entity: context.entity,
        ruleInstanceIds: [context.ruleInstanceId],
        userIds: context.userId ? [context.userId] : undefined,
        transactionIds: context.transactionId
          ? [context.transactionId]
          : undefined,
        isOngoingScreening: context?.isOngoingScreening,
        isHit: response.hitsCount > 0,
        searchId: response.searchId,
      }
      const sanctionsScreeningDetailsRepository =
        new SanctionsScreeningDetailsRepository(this.tenantId, {
          mongoDb: await this.getMongoDbClient(),
          dynamoDb: this.dynamoDb,
        })
      const [firstResult, secondResult] = await Promise.allSettled([
        sanctionsScreeningDetailsRepository.addSanctionsScreeningDetails(
          details,
          Date.now()
        ),
        sanctionsScreeningDetailsRepository.addSanctionsScreeningDetailsV2(
          details,
          Date.now()
        ),
      ])

      // Log any rejected promises
      if (firstResult.status === 'rejected') {
        logger.error(
          'Failed to save screening details - addSanctionsScreeningDetails:',
          {
            error: firstResult.reason,
            searchId: response.searchId,
            entity: context.entity,
            ruleInstanceId: context.ruleInstanceId,
            operation: 'addSanctionsScreeningDetails',
          }
        )
      }

      if (secondResult.status === 'rejected') {
        logger.error(
          'Failed to save screening details - addSanctionsScreeningDetailsV2:',
          {
            error: secondResult.reason,
            searchId: response.searchId,
            entity: context.entity,
            ruleInstanceId: context.ruleInstanceId,
            operation: 'addSanctionsScreeningDetailsV2',
          }
        )
      }
    }
    return response
  }

  public createHitsForSearch(
    provider: SanctionsDataProviderName,
    search: SanctionsSearchResponse,
    hitContext: SanctionsHitContext | undefined
  ): Promise<SanctionsHit[]> {
    return this.sanctionsHitsRepository.addHits(
      provider,
      search.searchId,
      search.data ?? [],
      hitContext
    )
  }

  private getSanitizedFuzziness(
    fuzziness: number | undefined
  ): number | undefined {
    if (fuzziness == null) {
      return DEFAULT_FUZZINESS
    }
    return fuzziness
  }

  public async getSearchHistories(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    // TODO: also based on params, filter return results based on dates

    return this.sanctionsSearchRepository.getSearchHistory(params)
  }

  public async getSearchHistory(
    searchId: string,
    page?: number,
    pageSize?: number
  ): Promise<SanctionsSearchHistory | null> {
    return await this.sanctionsSearchRepository.getSearchResultPaginated(
      searchId,
      page ?? 1,
      pageSize ?? 20
    )
  }

  public async getSanctionsScreeningStats(timeRange?: {
    from: number
    to: number
  }): Promise<SanctionsScreeningStats> {
    const sanctionsScreeningDetailsRepository =
      new SanctionsScreeningDetailsRepository(this.tenantId, {
        mongoDb: await this.getMongoDbClient(),
        dynamoDb: this.dynamoDb,
      })
    return await sanctionsScreeningDetailsRepository.getSanctionsScreeningStats(
      timeRange
    )
  }

  public async getSanctionsScreeningDetails(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    const sanctionsScreeningDetailsRepository =
      new SanctionsScreeningDetailsRepository(this.tenantId, {
        mongoDb: await this.getMongoDbClient(),
        dynamoDb: this.dynamoDb,
      })
    return await sanctionsScreeningDetailsRepository.getSanctionsScreeningDetails(
      params
    )
  }

  public async searchWhitelistEntities(
    params: {
      filterUserId?: string[]
      filterEntity?: SanctionsScreeningEntity[]
      filterEntityType?: SanctionsDetailsEntityType[]
    } & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsWhitelistEntity>> {
    return this.sanctionsWhitelistEntityRepository.searchWhitelistEntities(
      params
    )
  }

  public async deleteWhitelistRecord(
    sanctionsWhitelistIds: string[]
  ): Promise<void> {
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(
      sanctionsWhitelistIds
    )
  }

  private async getRelevance(
    provider?: SanctionsDataProviderName,
    sourceType?: GenericSanctionsSearchType
  ) {
    switch (provider) {
      case 'dowjones': {
        switch (sourceType) {
          case 'SANCTIONS':
            return SANCTIONS_SOURCE_RELEVANCES
          case 'PEP':
            return DOW_JONES_PEP_SOURCE_RELEVANCES
          case 'ADVERSE_MEDIA':
            return DOW_JONES_ADVERSE_MEDIA_SOURCE_RELEVANCES
          default:
            return []
        }
      }
      case 'acuris': {
        switch (sourceType) {
          case 'SANCTIONS':
            return SANCTIONS_SOURCE_RELEVANCES
          case 'PEP':
            return PEP_SOURCE_RELEVANCES
          case 'ADVERSE_MEDIA':
            return ADVERSE_MEDIA_SOURCE_RELEVANCES
          case 'REGULATORY_ENFORCEMENT_LIST':
            return REL_SOURCE_RELEVANCES
          default:
            return []
        }
      }
      case 'open-sanctions': {
        const collectionName = getSanctionsSourceDocumentsCollectionName([
          provider,
        ])
        const collection = (await this.getMongoDbClient())
          .db()
          .collection<SourceDocument>(collectionName)
        const pepRelevance = await collection
          .find({
            sourceType: 'PEP',
            provider: provider,
          })
          .project({
            id: 1,
          })
          .toArray()
        const crimeRelevance = await collection
          .find({
            sourceType: 'CRIME',
            provider: provider,
          })
          .project({
            id: 1,
          })
          .toArray()
        switch (sourceType) {
          case 'SANCTIONS':
            return []
          case 'PEP':
            return uniq(pepRelevance.map((relevance) => relevance.id))
          case 'CRIME':
            return uniq(crimeRelevance.map((relevance) => relevance.id))
          default:
            return []
        }
      }
      default:
        return []
    }
  }

  public async getSanctionsSources(
    filterSourceType?: GenericSanctionsSearchType,
    searchTerm?: string,
    provider?: SanctionsDataProviderName
  ): Promise<SanctionsSourceListResponse> {
    const sanctionsSourcesRepository = new MongoSanctionSourcesRepository(
      await this.getMongoDbClient(),
      getSanctionsSourceDocumentsCollectionName(
        getDefaultProviders(),
        this.tenantId
      )
    )
    const sources = await sanctionsSourcesRepository.getSanctionsSources(
      filterSourceType,
      [],
      true,
      searchTerm,
      undefined,
      provider
    )

    return {
      relevance: await this.getRelevance(provider, filterSourceType),
      sources:
        sources?.map((source) => {
          const picked = pick(source, [
            'id',
            'sourceType',
            'sourceCountry',
            'displayName',
            'entityCount',
          ])
          return picked
        }) ?? [],
    }
  }

  public async getSanctionsAcurisCopywritedSourceDownload(
    params: DefaultApiGetAcurisCopywritedSourceDownloadUrlRequest,
    s3: S3Client
  ): Promise<{
    url: string
  }> {
    const { resourceId, evidenceId, entityType } = params
    const entityTypeKey =
      entityType === 'BUSINESS' || entityType === 'BANK'
        ? 'businesses'
        : 'individuals'
    const fileKey = `acuris-evidence/${entityTypeKey}/${resourceId}/${evidenceId}`
    const { TMP_BUCKET } = process.env as CaseConfig
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: TMP_BUCKET,
        Key: fileKey,
      })

      await s3.send(headCommand)

      const getObjectCommand = new GetObjectCommand({
        Bucket: TMP_BUCKET,
        Key: fileKey,
      })

      const url = await getSignedUrl(s3, getObjectCommand, {
        expiresIn: 3600,
      })

      return { url: url }
    } catch (error) {
      try {
        const apiKey = (await getSecretByName('acuris')).apiKey
        const acurisUrl = getSourceUrl(entityTypeKey, resourceId, evidenceId)
        const response = await fetch(acurisUrl, {
          headers: {
            accept: 'application/pdf',
            'x-api-key': apiKey,
          },
        })

        if (!response.ok || !response.body) {
          throw new Error(
            `Acuris API error: ${response.status} ${response.statusText}`
          )
        }

        const upload = new Upload({
          client: s3,
          params: {
            Bucket: TMP_BUCKET,
            Key: fileKey,
            Body: response.body,
            ContentType: 'application/pdf',
            Metadata: {
              resourceId,
              evidenceId,
              downloadedAt: new Date().toISOString(),
              source: 'acuris-api',
            },
            Expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })

        await upload.done()

        const getObjectCommand = new GetObjectCommand({
          Bucket: TMP_BUCKET,
          Key: fileKey,
        })

        const url = await getSignedUrl(s3, getObjectCommand, {
          expiresIn: 3600,
        })

        return { url }
      } catch (error) {
        logger.error('Failed to download file from Acuris API', { error })
        throw error
      }
    }
  }

  public async getMediaCheckArticles(
    params: DefaultApiGetMediaCheckArticlesRequest
  ): Promise<MediaCheckArticleResponse> {
    const {
      searchId,
      pageSize = 10,
      fromCursorKey,
      sortOrder,
      sortField = '_id',
    } = params
    const mongoDb = this.mongoDb ?? (await getMongoDbClient())
    const collection = mongoDb
      .db()
      .collection<MediaCheckArticleResponseItem>(
        LSEG_API_MEDIA_CHECK_RESULT_COLLECTION(this.tenantId)
      )
    const search = await this.sanctionsSearchRepository.getSearchResult(
      searchId
    )
    const filterCaseId = search?.response?.providerReferenceIds?.[0]
    if (!filterCaseId) {
      throw new Error('Search not found')
    }
    const result = await cursorPaginate(
      collection,
      {
        lsegCaseId: filterCaseId,
      },
      {
        pageSize: pageSize,
        fromCursorKey: fromCursorKey,
        sortOrder: sortOrder,
        sortField: sortField,
      }
    )
    return result
  }
}
