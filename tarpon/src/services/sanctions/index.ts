import { v4 as uuidv4 } from 'uuid'
import { intersection, omit, pick, round, startCase, uniq } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { sanitizeString } from '@flagright/lib/utils'
import pluralize from 'pluralize'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { AlertsRepository } from '../alerts/repository'
import { AlertsService } from '../alerts'
import { CaseService } from '../cases'
import { UserService } from '../users'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import {
  SanctionsWhitelistEntityRepository,
  WhitelistSubject,
} from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsScreeningDetailsRepository } from './repositories/sanctions-screening-details-repository'
import { AcurisProvider } from './providers/acuris-provider'
import { MongoSanctionSourcesRepository } from './repositories/sanction-source-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionHitStatusUpdateRequest } from '@/@types/openapi-internal/SanctionHitStatusUpdateRequest'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DefaultApiGetSanctionsScreeningActivityDetailsRequest,
  DefaultApiGetSanctionsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { traceable } from '@/core/xray'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsHitListResponse } from '@/@types/openapi-internal/SanctionsHitListResponse'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
  iterateCursorItems,
} from '@/utils/pagination'
import {
  GenericSanctionsSearchType,
  RuleStage,
  SanctionsDataProviderName,
  SanctionsEntity,
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
import { getDynamoDbClient } from '@/utils/dynamodb'
import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { logger } from '@/core/logger'
import { SANCTIONS_SOURCE_DOCUMENTS_COLLECTION } from '@/utils/mongodb-definitions'

const DEFAULT_FUZZINESS = 0.5

export type ProviderConfig = {
  providerName?: SanctionsDataProviderName
  stage: RuleStage
  listId?: string
}

@traceable
export class SanctionsService {
  complyAdvantageSearchProfileId: string | undefined
  sanctionsSearchRepository!: SanctionsSearchRepository
  sanctionsHitsRepository!: SanctionsHitsRepository
  sanctionsSourcesRepository!: MongoSanctionSourcesRepository
  sanctionsWhitelistEntityRepository!: SanctionsWhitelistEntityRepository
  sanctionsScreeningDetailsRepository!: SanctionsScreeningDetailsRepository
  counterRepository!: CounterRepository
  tenantId: string
  initializationPromise: Promise<void> | null = null
  caseService!: CaseService
  userService!: UserService
  alertsService!: AlertsService

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const [caseService, userService, alertsService] = await Promise.all([
      CaseService.fromEvent(event),
      UserService.fromEvent(event),
      AlertsService.fromEvent(event),
    ])
    const sanctionsService = new SanctionsService(tenantId)
    sanctionsService.caseService = caseService
    sanctionsService.userService = userService
    sanctionsService.alertsService = alertsService
    return sanctionsService
  }

  private async initializeInternal() {
    const mongoDb = await getMongoDbClient()
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, mongoDb)
    this.sanctionsScreeningDetailsRepository =
      new SanctionsScreeningDetailsRepository(this.tenantId, mongoDb)
    this.counterRepository = new CounterRepository(this.tenantId, mongoDb)
    this.sanctionsHitsRepository = new SanctionsHitsRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsSourcesRepository = new MongoSanctionSourcesRepository(
      SANCTIONS_SOURCE_DOCUMENTS_COLLECTION(),
      mongoDb
    )
  }

  private async getProvider(
    provider: SanctionsDataProviderName,
    providerConfig?: ProviderConfig
  ): Promise<SanctionsDataProvider> {
    switch (provider) {
      case 'comply-advantage':
        return await ComplyAdvantageDataProvider.build(
          this.tenantId,
          providerConfig?.stage
        )
      case 'dowjones':
        return await DowJonesProvider.build(this.tenantId)
      case 'open-sanctions':
        return OpenSanctionsProvider.build(this.tenantId)
      case 'acuris':
        return AcurisProvider.build(this.tenantId)
      case 'list':
        if (!providerConfig?.listId) {
          throw new Error(`No list ID given for list sanctions provider`)
        }
        return await SanctionsListProvider.build(
          this.tenantId,
          providerConfig.listId
        )
    }
    throw new Error(`Unknown provider ${provider}`)
  }

  private async initialize() {
    this.initializationPromise =
      this.initializationPromise ?? this.initializeInternal()
    await this.initializationPromise
  }

  public async refreshSearch(
    providerSearchId: string,
    providerName: SanctionsDataProviderName
  ): Promise<boolean> {
    await this.initialize()
    const result =
      await this.sanctionsSearchRepository.getSearchResultByProviderSearchId(
        providerName,
        providerSearchId
      )
    if (!result) {
      return false
    }
    const provider = await this.getProvider(providerName)
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

    await this.initialize()
    const providers = getDefaultProviders()
    const providerName = providerOverrides?.providerName || providers[0]

    // Normalize search term
    request.searchTerm =
      providerName === 'comply-advantage'
        ? startCase(request.searchTerm.toLowerCase())
        : request.searchTerm
    if (
      !request.searchTerm ||
      (providerName !== 'comply-advantage' &&
        !sanitizeString(request.searchTerm)) ||
      !providerName ||
      (request.yearOfBirth &&
        (request.yearOfBirth < 1900 || request.yearOfBirth > dayjs().year()))
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
      const provider = await this.getProvider(providerName, providerOverrides)

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
      await this.sanctionsScreeningDetailsRepository.addSanctionsScreeningDetails(
        details,
        Date.now()
      )
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
    await this.initialize()
    return this.sanctionsSearchRepository.getSearchHistory(params)
  }

  public async getSearchHistory(
    searchId: string,
    page?: number,
    pageSize?: number
  ): Promise<SanctionsSearchHistory | null> {
    await this.initialize()
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
    await this.initialize()
    return await this.sanctionsScreeningDetailsRepository.getSanctionsScreeningStats(
      timeRange
    )
  }

  public async getSanctionsScreeningDetails(
    params: DefaultApiGetSanctionsScreeningActivityDetailsRequest
  ): Promise<SanctionsScreeningDetailsResponse> {
    await this.initialize()
    return this.sanctionsScreeningDetailsRepository.getSanctionsScreeningDetails(
      params
    )
  }

  public async updateSearch(
    searchId: string,
    update: SanctionsSearchMonitoring,
    providerOverrides?: ProviderConfig
  ): Promise<void> {
    await this.initialize()
    const search = await this.getSearchHistory(searchId)
    if (!search) {
      logger.error(`Cannot find search ${searchId}. Skip updating search.`)
      return
    }
    const providerSearchId = search.response?.providerSearchId || ''
    if (providerSearchId == null) {
      throw new Error(`Unable to get search id from response`)
    }

    const provider = await this.getProvider(search.provider, providerOverrides)
    await provider.setMonitoring(providerSearchId, update.enabled)
    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
    )
  }

  public async addWhitelistEntities(
    provider: SanctionsDataProviderName,
    entities: SanctionsEntity[],
    subject: WhitelistSubject,
    options?: {
      reason?: string[]
      comment?: string
      createdAt?: number
    }
  ) {
    await this.initialize()
    return await this.sanctionsWhitelistEntityRepository.addWhitelistEntities(
      provider,
      entities,
      subject,
      options
    )
  }

  public async searchWhitelistEntities(
    params: {
      filterUserId?: string[]
      filterEntity?: SanctionsScreeningEntity[]
      filterEntityType?: SanctionsDetailsEntityType[]
    } & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsWhitelistEntity>> {
    await this.initialize()
    return this.sanctionsWhitelistEntityRepository.searchWhitelistEntities(
      params
    )
  }

  public async deleteWhitelistRecord(
    sanctionsWhitelistIds: string[]
  ): Promise<void> {
    await this.initialize()
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(
      sanctionsWhitelistIds
    )
  }

  public async deleteWhitelistRecordsByHits(
    sanctionsHitIds: string[]
  ): Promise<void> {
    await this.initialize()
    const hitsIterator = iterateCursorItems(async ({ from }) =>
      this.sanctionsHitsRepository.searchHits({
        fromCursorKey: from,
        filterHitIds: sanctionsHitIds,
      })
    )
    const ids: string[] = []
    for await (const hit of hitsIterator) {
      const whitelistEntriesIterator = iterateCursorItems(async ({ from }) =>
        this.sanctionsWhitelistEntityRepository.searchWhitelistEntities({
          fromCursorKey: from,
          filterUserId: hit.hitContext?.userId
            ? [hit.hitContext?.userId]
            : undefined,
          filterEntity: hit.hitContext?.entity
            ? [hit.hitContext?.entity]
            : undefined,
          filterEntityType: hit.hitContext?.entityType
            ? [hit.hitContext?.entityType]
            : undefined,
        })
      )
      for await (const entry of whitelistEntriesIterator) {
        ids.push(entry.sanctionsWhitelistId)
      }
    }
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(ids)
  }

  /*
    Methods to work with hits
   */
  public async searchHits(
    params: {
      filterHitIds?: string[]
      filterSearchId?: string[]
      filterPaymentMethodId?: string[]
      filterStatus?: SanctionsHitStatus[]
      alertId?: string
      ruleId?: string
      filterUserId?: string
      filterScreeningHitEntityType?: SanctionsDetailsEntityType
    } & CursorPaginationParams
  ): Promise<SanctionsHitListResponse> {
    if (params.alertId) {
      const alertsRepository = new AlertsRepository(this.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      })
      const alert = await alertsRepository.getAlertById(params.alertId)
      if (alert) {
        if (params.filterPaymentMethodId) {
          params.filterSearchId = undefined
        }
        params.filterHitIds = alert.ruleHitMeta?.sanctionsDetails
          ?.filter((data) => {
            if (params.filterPaymentMethodId) {
              return params.filterPaymentMethodId.includes(
                data.hitContext?.paymentMethodId ?? ''
              )
            }
            if (params.filterSearchId) {
              return (
                params.filterSearchId.includes(data.searchId) &&
                (!params.filterScreeningHitEntityType ||
                  data.entityType === params.filterScreeningHitEntityType)
              )
            }
            return false
          })
          .flatMap(({ sanctionHitIds }) => sanctionHitIds ?? [])
        params.ruleId = alert.ruleId
        params.filterUserId =
          alert.ruleHitMeta?.sanctionsDetails?.[0]?.hitContext?.userId ??
          undefined
      }
    }
    await this.initialize()
    return await this.sanctionsHitsRepository.searchHits(params)
  }

  public async updateHits(
    sanctionsHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<{ modifiedCount: number }> {
    await this.initialize()
    const { modifiedCount } =
      await this.sanctionsHitsRepository.updateHitsByIds(sanctionsHitIds, {
        status: updates.status,
        clearingReason: updates.reasons,
      })
    // todo: add audit log record
    return { modifiedCount }
  }

  public async getSanctionsSources(
    filterSourceType?: SanctionsSourceType
  ): Promise<SanctionsSourceListResponse> {
    await this.initialize()
    const sources = await this.sanctionsSourcesRepository.getSanctionsSources(
      filterSourceType,
      [],
      true
    )
    return {
      items:
        sources?.map((source) =>
          pick(source, ['id', 'sourceName', 'sourceType'])
        ) ?? [],
    }
  }

  public async changeSanctionsHitsStatus(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<{ modifiedCount: number }> {
    await this.initialize()
    const result = await this.updateHits(sanctionHitIds, updates)
    const whitelistUpdateComment = await this.handleWhitelistUpdates(
      alertId,
      sanctionHitIds,
      updates
    )
    await this.addComments(
      alertId,
      sanctionHitIds,
      updates,
      whitelistUpdateComment
    )
    return result
  }

  private async handleWhitelistUpdates(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<string | null> {
    const { whitelistHits, removeHitsFromWhitelist } = updates
    let whitelistUpdateComment: string | null = null

    if (updates.status === 'OPEN' && removeHitsFromWhitelist) {
      await this.deleteWhitelistRecordsByHits(sanctionHitIds)
    }

    if (updates.status === 'CLEARED' && whitelistHits) {
      for await (const hit of this.sanctionsHitsRepository.iterateHits({
        filterHitIds: sanctionHitIds,
      })) {
        if (hit.hitContext && hit.hitContext.userId != null && hit.entity) {
          const { newRecords } = await this.addWhitelistEntities(
            hit.provider,
            [hit.entity],
            {
              userId: hit.hitContext.userId,
              entity: hit.hitContext.entity,
              entityType: hit.hitContext.entityType,
              searchTerm: hit.hitContext.searchTerm,
              paymentMethodId: hit.hitContext.paymentMethodId,
              alertId: alertId,
            },
            {
              reason: updates.reasons,
              comment: updates.comment,
            }
          )

          if (newRecords.length > 0) {
            whitelistUpdateComment = `${pluralize(
              'record',
              newRecords.length,
              true
            )} added to whitelist for '${hit.hitContext.userId}' user`
          }
        }
      }
    }

    return whitelistUpdateComment
  }

  private async addComments(
    alertId: string,
    sanctionHitIds: string[],
    updates: SanctionHitStatusUpdateRequest,
    whitelistUpdateComment: string | null
  ): Promise<void> {
    const isSingleHit = sanctionHitIds.length === 1
    const reasonsComment = AlertsService.formatReasonsComment(updates)

    // Add user comment
    const caseItem = await this.caseService.getCaseByAlertId(alertId)
    const userId =
      caseItem?.caseUsers?.origin?.userId ??
      caseItem?.caseUsers?.destination?.userId ??
      null

    if (userId != null) {
      let userCommentBody = `${sanctionHitIds.join(', ')} ${
        isSingleHit ? 'hit is' : 'hits are'
      } are moved to "${updates.status}" status from alert '${alertId}'`
      if (reasonsComment !== '') {
        userCommentBody += `. Reasons: ` + reasonsComment
      }
      if (whitelistUpdateComment !== '') {
        userCommentBody += `. ${whitelistUpdateComment}`
      }
      if (updates?.comment) {
        userCommentBody += `\n\nComment: ${updates.comment}`
      }
      await this.userService.saveUserComment(userId, {
        body: userCommentBody,
        files: updates.files,
      })
    }

    // Add alert comment
    let alertCommentBody = `${sanctionHitIds.join(', ')} ${
      isSingleHit ? 'hit is' : 'hits are'
    } moved to "${updates.status}" status`
    if (reasonsComment !== '') {
      alertCommentBody += `. Reasons: ` + reasonsComment
    }
    if (whitelistUpdateComment) {
      alertCommentBody += `. ${whitelistUpdateComment}`
    }
    if (updates?.comment) {
      alertCommentBody += `\n\nComment: ${updates.comment}`
    }
    await this.alertsService.saveComment(alertId, {
      body: alertCommentBody,
      files: updates.files,
    })
  }
}
