import { v4 as uuidv4 } from 'uuid'
import { intersection, omit, pick, round, startCase, uniq } from 'lodash'
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
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsWhitelistEntityRepository } from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsScreeningDetailsRepository } from './repositories/sanctions-screening-details-repository'
import { AcurisProvider } from './providers/acuris-provider'
import { MongoSanctionSourcesRepository } from './repositories/sanction-source-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DefaultApiGetAcurisCopywritedSourceDownloadUrlRequest,
  DefaultApiGetSanctionsScreeningActivityDetailsRequest,
  DefaultApiGetSanctionsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { traceable } from '@/core/xray'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/utils/pagination'
import {
  GenericSanctionsSearchType,
  RuleStage,
  SanctionsDataProviderName,
  SanctionsHit,
  SanctionsSearchResponse,
  SanctionsSourceListResponse,
  SanctionsSourceType,
} from '@/@types/openapi-internal/all'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
} from '@/services/sanctions/providers/types'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { ComplyAdvantageDataProvider } from '@/services/sanctions/providers/comply-advantage-provider'
import {
  DEFAULT_PROVIDER_TYEPS_MAP,
  getDefaultProviders,
} from '@/services/sanctions/utils'
import { SanctionsListProvider } from '@/services/sanctions/providers/sanctions-list-provider'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { logger } from '@/core/logger'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { getSecretByName } from '@/utils/secrets-manager'

const DEFAULT_FUZZINESS = 0.5

export type ProviderConfig = {
  providerName?: SanctionsDataProviderName
  stage: RuleStage
  listId?: string
}

@traceable
export class SanctionsService {
  complyAdvantageSearchProfileId: string | undefined
  sanctionsSearchRepository: SanctionsSearchRepository
  sanctionsHitsRepository: SanctionsHitsRepository
  sanctionsSourcesRepository: MongoSanctionSourcesRepository
  sanctionsWhitelistEntityRepository: SanctionsWhitelistEntityRepository
  sanctionsScreeningDetailsRepository: SanctionsScreeningDetailsRepository
  counterRepository: CounterRepository
  tenantId: string
  initializationPromise: Promise<void> | null = null
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      })
    this.sanctionsScreeningDetailsRepository =
      new SanctionsScreeningDetailsRepository(this.tenantId, this.mongoDb)
    this.counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.sanctionsHitsRepository = new SanctionsHitsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.sanctionsSourcesRepository = new MongoSanctionSourcesRepository(
      this.mongoDb
    )
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const sanctionsService = new SanctionsService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    return sanctionsService
  }

  private async getProvider(
    provider: SanctionsDataProviderName,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    providerConfig?: ProviderConfig
  ): Promise<SanctionsDataProvider> {
    switch (provider) {
      case 'comply-advantage':
        return await ComplyAdvantageDataProvider.build(
          this.tenantId,
          providerConfig?.stage
        )
      case 'dowjones':
        return await DowJonesProvider.build(this.tenantId, connections)
      case 'open-sanctions':
        return OpenSanctionsProvider.build(this.tenantId, connections)
      case 'acuris':
        return AcurisProvider.build(this.tenantId, connections)
      case 'list':
        if (!providerConfig?.listId) {
          throw new Error(`No list ID given for list sanctions provider`)
        }
        return await SanctionsListProvider.build(
          this.tenantId,
          providerConfig.listId
        )
    }
  }

  public async refreshSearch(
    providerSearchId: string,
    providerName: SanctionsDataProviderName
  ): Promise<boolean> {
    const result =
      await this.sanctionsSearchRepository.getSearchResultByProviderSearchId(
        providerName,
        providerSearchId
      )
    if (!result) {
      return false
    }
    const provider = await this.getProvider(providerName, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
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
    return intersection(
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
  }

  private isSearchTermInvalid(
    searchTerm: string,
    providerName: SanctionsDataProviderName
  ): boolean {
    if (!searchTerm) {
      return true
    }
    if (providerName !== 'comply-advantage') {
      if (
        hasFeature('TRANSLITERATION') &&
        !isLatinScript(normalize(searchTerm))
      ) {
        return false
      }
      if (!sanitizeString(searchTerm)) {
        return true
      }
    }
    return false
  }

  private isYearOfBirthInvalid(yearOfBirth: number | undefined): boolean {
    return !!yearOfBirth && (yearOfBirth < 1900 || yearOfBirth > dayjs().year())
  }

  public async search(
    request: SanctionsSearchRequest,
    context?: SanctionsHitContext & {
      isOngoingScreening?: boolean
    },
    providerOverrides?: ProviderConfig,
    screeningEntity: 'USER' | 'TRANSACTION' = 'USER'
  ): Promise<SanctionsSearchResponse> {
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

    // Normalize search term
    request.searchTerm =
      providerName === 'comply-advantage'
        ? startCase(request.searchTerm.toLowerCase())
        : request.searchTerm

    if (
      this.isSearchTermInvalid(request.searchTerm, providerName) ||
      !providerName ||
      this.isYearOfBirthInvalid(request.yearOfBirth)
    ) {
      return {
        providerSearchId: 'invalid_search',
        data: [],
        hitsCount: 0,
        searchId: 'invalid_search',
        createdAt: Date.now(),
      }
    }

    request.fuzziness = this.getSanitizedFuzziness(
      request.fuzziness,
      providerName
    )
    request.types = this.getSanctionsSearchType(request.types, providers)
    let searchId: string = uuidv4()
    let providerSearchId: string
    let createdAt: number | undefined = undefined

    let existedSearch: SanctionsSearchHistory | null = null
    existedSearch =
      providerName === 'comply-advantage'
        ? await this.sanctionsSearchRepository.getSearchResultByParams(
            providerName,
            request,
            providerOverrides
          )
        : null
    let sanctionsSearchResponse: SanctionsProviderResponse

    // Only cache results from comply advantage
    const shouldSearch =
      !existedSearch?.response || providerName !== 'comply-advantage'
    if (shouldSearch) {
      const provider = await this.getProvider(
        providerName,
        { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb },
        providerOverrides
      )

      if (providerName !== 'comply-advantage') {
        let existedSearch: SanctionsSearchHistory | null
        ;[sanctionsSearchResponse, existedSearch] = await Promise.all([
          provider.search(request),
          this.sanctionsSearchRepository.getSearchResultByParams(
            providerName,
            request,
            providerOverrides
          ),
        ])
        searchId = existedSearch?.response?.searchId ?? searchId // As we search anyways when provider is not comply advantage, we can use the searchId from the response to avoid duplicates
      } else {
        sanctionsSearchResponse = await provider.search(request)
      }
      providerSearchId = sanctionsSearchResponse.providerSearchId
    } else {
      createdAt = existedSearch?.createdAt
      searchId = existedSearch?.response?.searchId || ''
      providerSearchId = existedSearch?.response?.providerSearchId || ''
      sanctionsSearchResponse =
        existedSearch?.response as SanctionsSearchResponse
    }

    const filteredHits =
      await this.sanctionsHitsRepository.filterWhitelistedHits(
        sanctionsSearchResponse.data ?? [],
        context,
        providerName
      )

    const response: SanctionsSearchResponse = {
      searchId,
      data: filteredHits,
      hitsCount: filteredHits.length,
      providerSearchId: providerSearchId,
      createdAt: createdAt ?? Date.now(),
    }

    if (shouldSearch && (!hasFeature('DOW_JONES') || response.hitsCount > 0)) {
      await this.sanctionsSearchRepository.saveSearchResult({
        provider: providerName,
        createdAt: createdAt,
        request,
        requestHash: generateChecksum(
          getSortedObject(omit(request, ['fuzzinessRange', 'fuzziness']))
        ),
        response,
        searchedBy: !context ? getContext()?.user?.id : undefined,
        hitContext: context,
        providerConfigHash:
          providerOverrides &&
          providerOverrides.stage &&
          !hasFeature('DOW_JONES')
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
    }

    if (
      !existedSearch?.response &&
      providerName === 'comply-advantage' &&
      request.monitoring
    ) {
      await this.updateSearch(searchId, request.monitoring, providerOverrides)
    }

    if (context && context.ruleInstanceId) {
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
      const [firstResult, secondResult] = await Promise.allSettled([
        this.sanctionsScreeningDetailsRepository.addSanctionsScreeningDetails(
          details,
          Date.now()
        ),
        this.sanctionsScreeningDetailsRepository.addSanctionsScreeningDetailsV2(
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
    fuzziness: number | undefined,
    providerName: SanctionsDataProviderName
  ): number | undefined {
    if (fuzziness == null) {
      return DEFAULT_FUZZINESS
    }
    if (providerName === 'comply-advantage') {
      // From ComplyAdvantage: Ensure that there are no more than 1 decimal places.
      return round(fuzziness, 1)
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
    return await this.sanctionsScreeningDetailsRepository.getSanctionsScreeningStats(
      timeRange
    )
  }

  public async getSanctionsScreeningDetails(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    return this.sanctionsScreeningDetailsRepository.getSanctionsScreeningDetails(
      params
    )
  }

  public async updateSearch(
    searchId: string,
    update: SanctionsSearchMonitoring,
    providerOverrides?: ProviderConfig
  ): Promise<void> {
    const search = await this.getSearchHistory(searchId)
    if (!search) {
      logger.error(`Cannot find search ${searchId}. Skip updating search.`)
      return
    }
    const providerSearchId = search.response?.providerSearchId || ''
    if (providerSearchId == null) {
      throw new Error(`Unable to get search id from response`)
    }

    const provider = await this.getProvider(
      search.provider,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb },
      providerOverrides
    )
    await provider.setMonitoring(providerSearchId, update.enabled)
    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
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

  public async getSanctionsSources(
    filterSourceType?: SanctionsSourceType,
    searchTerm?: string
  ): Promise<SanctionsSourceListResponse> {
    const sources = await this.sanctionsSourcesRepository.getSanctionsSources(
      filterSourceType,
      [],
      true,
      searchTerm
    )
    return {
      items:
        sources?.map((source) => {
          const picked = pick(source, [
            'id',
            'sourceName',
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
}
