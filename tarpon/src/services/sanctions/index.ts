import { v4 as uuidv4 } from 'uuid'
import { BadRequest } from 'http-errors'
import { isEmpty, round, startCase } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { AlertsRepository } from '../alerts/repository'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import {
  SanctionsWhitelistEntityRepository,
  WhitelistSubject,
} from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsScreeningDetailsRepository } from './repositories/sanctions-screening-details-repository'
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
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { getContext } from '@/core/utils/context'
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
  SanctionsDataProviderName,
  SanctionsEntity,
  SanctionsHit,
  SanctionsSearchResponse,
} from '@/@types/openapi-internal/all'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
} from '@/services/sanctions/providers/types'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { ComplyAdvantageDataProvider } from '@/services/sanctions/providers/comply-advantage-provider'
import { getDefaultProvider } from '@/services/sanctions/utils'
import { SanctionsListProvider } from '@/services/sanctions/providers/sanctions-list-provider'
import { getDynamoDbClient } from '@/utils/dynamodb'

const DEFAULT_FUZZINESS = 0.5

type ProviderConfig = {
  providerName: SanctionsDataProviderName
  listId: string
}

@traceable
export class SanctionsService {
  complyAdvantageSearchProfileId: string | undefined
  sanctionsSearchRepository!: SanctionsSearchRepository
  sanctionsHitsRepository!: SanctionsHitsRepository
  sanctionsWhitelistEntityRepository!: SanctionsWhitelistEntityRepository
  sanctionsScreeningDetailsRepository!: SanctionsScreeningDetailsRepository
  counterRepository!: CounterRepository
  tenantId: string
  initializationPromise: Promise<void> | null = null

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private async initializeInternal() {
    const mongoDb = await getMongoDbClient()
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, mongoDb)
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsScreeningDetailsRepository =
      new SanctionsScreeningDetailsRepository(this.tenantId, mongoDb)
    this.counterRepository = new CounterRepository(this.tenantId, mongoDb)
    this.sanctionsHitsRepository = new SanctionsHitsRepository(
      this.tenantId,
      mongoDb
    )
  }

  private async getProvider(
    provider: SanctionsDataProviderName,
    providerConfig?: ProviderConfig
  ): Promise<SanctionsDataProvider> {
    switch (provider) {
      case 'comply-advantage':
        return await ComplyAdvantageDataProvider.build(this.tenantId)
      case 'dowjones':
        return await DowJonesProvider.build(this.tenantId)
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

    const newHits = await this.sanctionsHitsRepository.addNewHits(
      providerName,
      result._id,
      response.data || [],
      result.hitContext
    )

    const parsedResponse = {
      hitsCount: (result.response?.hitsCount ?? 0) + newHits.length,
      searchId: result._id,
      providerSearchId: response.providerSearchId,
      createdAt: Date.now(),
    }
    await this.sanctionsSearchRepository.saveSearchResult({
      provider: providerName,
      request: result.request,
      response: parsedResponse,
      createdAt: result.createdAt,
      updatedAt: Date.now(),
      hitContext: result.hitContext,
    })

    logger.info(
      `Updated monitored search (search ID: ${providerSearchId}) for tenant ${this.tenantId}`
    )

    return true
  }

  public async search(
    request: SanctionsSearchRequest,
    context?: SanctionsHitContext & {
      isOngoingScreening?: boolean
    },
    providerOverrides?: ProviderConfig
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()

    const providerName = providerOverrides?.providerName || getDefaultProvider()

    // Normalize search term
    request.searchTerm = startCase(request.searchTerm.toLowerCase())
    if (
      !request.searchTerm ||
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

    request.fuzziness = this.getSanitizedFuzziness(request.fuzziness)
    request.types = request.types?.length
      ? request.types
      : SANCTIONS_SEARCH_TYPES

    let searchId: string = uuidv4()
    let providerSearchId: string
    let createdAt: number | undefined = undefined

    let existedSearch: SanctionsSearchHistory | null = null
    existedSearch =
      await this.sanctionsSearchRepository.getSearchResultByParams(
        providerName,
        request
      )

    let sanctionsSearchResponse: SanctionsProviderResponse

    // Only cache results from comply advantage
    if (!existedSearch?.response || providerName !== 'comply-advantage') {
      const provider = await this.getProvider(providerName, providerOverrides)
      sanctionsSearchResponse = await provider.search(request)
      providerSearchId = sanctionsSearchResponse.providerSearchId
    } else {
      createdAt = existedSearch?.createdAt
      searchId = existedSearch?.response.searchId
      providerSearchId = existedSearch?.response.providerSearchId
      sanctionsSearchResponse = existedSearch?.response
    }

    const filteredHits =
      await this.sanctionsHitsRepository.filterWhitelistedHits(
        sanctionsSearchResponse.data ?? [],
        context
      )

    const response: SanctionsSearchResponse = {
      searchId,
      data: filteredHits,
      hitsCount: filteredHits.length,
      providerSearchId: providerSearchId,
      createdAt: createdAt ?? Date.now(),
    }

    if (!existedSearch) {
      await this.sanctionsSearchRepository.saveSearchResult({
        provider: providerName,
        createdAt: createdAt,
        request,
        response,
        searchedBy: !context ? getContext()?.user?.id : undefined,
        hitContext: context,
      })
    }

    if (!existedSearch?.response && request.monitoring) {
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
      if (context.iban) {
        await this.sanctionsScreeningDetailsRepository.addSanctionsScreeningDetails(
          {
            ...details,
            name: context.iban,
            entity: 'IBAN',
          },
          Date.now()
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

    // From ComplyAdvantage: Ensure that there are no more than 1 decimal places.
    return round(fuzziness, 1)
  }

  public async getSearchHistories(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    // TODO: also based on params, filter return results based on dates
    await this.initialize()
    return this.sanctionsSearchRepository.getSearchHistory(params)
  }

  public async getSearchHistory(
    searchId: string
  ): Promise<SanctionsSearchHistory | null> {
    await this.initialize()
    return await this.sanctionsSearchRepository.getSearchResult(searchId)
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
      filterStatus?: SanctionsHitStatus[]
      alertId?: string
    } & CursorPaginationParams
  ): Promise<SanctionsHitListResponse> {
    if (params.alertId) {
      const alertsRepository = new AlertsRepository(this.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      })
      const alert = await alertsRepository.getAlertById(params.alertId)
      if (alert) {
        params.filterHitIds = alert.ruleHitMeta?.sanctionsDetails?.flatMap(
          ({ sanctionHitIds }) => sanctionHitIds ?? []
        )
        params.filterSearchId = undefined
      }
    }

    if (isEmpty(params.filterHitIds) && isEmpty(params.filterSearchId)) {
      throw new BadRequest('Search ID or Hit IDs must be provided')
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
}
