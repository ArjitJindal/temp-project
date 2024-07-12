import { v4 as uuidv4 } from 'uuid'
import { round, startCase } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsWhitelistEntityRepository } from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsScreeningDetailsRepository } from './repositories/sanctions-screening-details-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsHitContext } from '@/@types/openapi-internal/SanctionsHitContext'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { SanctionHitStatusUpdateRequest } from '@/@types/openapi-internal/SanctionHitStatusUpdateRequest'
import { ComplyAdvantageSearchResponse } from '@/@types/openapi-internal/ComplyAdvantageSearchResponse'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DefaultApiGetSanctionsScreeningActivityDetailsRequest,
  DefaultApiGetSanctionsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { getSecretByName } from '@/utils/secrets-manager'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { envIs } from '@/utils/env'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { getContext, tenantSettings } from '@/core/utils/context'
import { SanctionsScreeningDetailsResponse } from '@/@types/openapi-internal/SanctionsScreeningDetailsResponse'
import { SanctionsHitListResponse } from '@/@types/openapi-internal/SanctionsHitListResponse'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { SanctionsSettingsMarketType } from '@/@types/openapi-internal/SanctionsSettingsMarketType'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/utils/pagination'
import {
  ComplyAdvantageApi,
  ComplyAdvantageEntity,
} from '@/services/sanctions/comply-advantage-api'
import { SanctionsHit } from '@/@types/openapi-internal/all'

const DEFAULT_FUZZINESS = 0.5

function getSearchTypesKey(
  types: SanctionsSearchType[] = SANCTIONS_SEARCH_TYPES
) {
  const searchTypes = types.length ? types : SANCTIONS_SEARCH_TYPES
  return searchTypes.sort().reverse().join('-')
}

const SANDBOX_PROFILES = {
  [getSearchTypesKey(['SANCTIONS'])]: 'b5d54657-4370-45a2-acdd-a40956e02ef4',
  [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
    '65032c2f-d579-4ef6-8464-c8fbe9df11bb',
  [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
    '12517f27-42d7-4d43-85c4-b28835d284c7',
  [getSearchTypesKey(['PEP'])]: '9d9036f4-89c5-4e60-880a-3c5aacfbe3ed',
  [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
    '2fd847d0-a49b-4321-b0d8-6c42fa64c040',
  [getSearchTypesKey(['ADVERSE_MEDIA'])]:
    '1e99cb5e-36d2-422b-be1f-0024999b92b7',
  [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
    'd563b827-7baa-4a0c-a2ae-7e38e5051cf2',
}
const SEARCH_PROFILE_IDS: Record<
  'prod' | 'sandbox',
  Record<SanctionsSettingsMarketType, { [key: string]: string }>
> = {
  prod: {
    EMERGING: {
      [getSearchTypesKey(['SANCTIONS'])]:
        '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
      [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
        '8b51ca9d-4b45-4de7-bac8-3bebcf6041ab',
      [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
        '919d1abb-2add-46c1-b73a-0fbae79aee6d',
      [getSearchTypesKey(['PEP'])]: 'a9b22101-e5d5-477c-b2c7-2f875ebbd5d8',
      [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
        'e04c41ad-d3f0-4562-9b51-9d00a8965f16',
      [getSearchTypesKey(['ADVERSE_MEDIA'])]:
        '5a67aa5f-4ec8-4a61-af3a-78e3c132a24d',
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
        '15cb1d65-7f06-4eb3-84f5-f0cb9f1d4c8f',
    },
    FIRST_WORLD: {
      [getSearchTypesKey(['SANCTIONS'])]:
        '9abd440a-a746-4308-8b9d-219d7093990c',
      [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
        '77220fe4-892c-4e13-b57f-379a437ec521',
      [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
        '230ede36-a63e-414d-b343-97b2ff375a7c',
      [getSearchTypesKey(['PEP'])]: '17bdb7e6-1e97-4972-9dfb-56650b1f7d83',
      [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
        '4f4d18a4-f8b7-457e-a4a1-a9d3e5fa009c',
      [getSearchTypesKey(['ADVERSE_MEDIA'])]:
        'f1f5c970-991e-4c68-856b-1f4cfd790968',
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
        'a8eea736-c654-48a3-97d9-62ea43ef3031',
    },
  },
  sandbox: {
    EMERGING: SANDBOX_PROFILES,
    FIRST_WORLD: SANDBOX_PROFILES,
  },
}

@traceable
export class SanctionsService {
  complyAdvantageMarketType: SanctionsSettingsMarketType | undefined
  complyAdvantageSearchProfileId: string | undefined
  sanctionsSearchRepository!: SanctionsSearchRepository
  sanctionsHitsRepository!: SanctionsHitsRepository
  sanctionsWhitelistEntityRepository!: SanctionsWhitelistEntityRepository
  sanctionsScreeningDetailsRepository!: SanctionsScreeningDetailsRepository
  counterRepository!: CounterRepository
  complyAdvantageApi!: ComplyAdvantageApi
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

    const settings = await tenantSettings(this.tenantId)
    this.complyAdvantageSearchProfileId =
      settings.sanctions?.customSearchProfileId
    if (!settings.sanctions?.marketType) {
      logger.error('Tenant market type is not set')
    }
    this.complyAdvantageMarketType = settings.sanctions?.marketType
    this.complyAdvantageApi = new ComplyAdvantageApi(await this.getApiKey())
  }

  private async initialize() {
    this.initializationPromise =
      this.initializationPromise ?? this.initializeInternal()
    await this.initializationPromise
  }

  private async getApiKey(): Promise<string> {
    if (process.env.COMPLYADVANTAGE_API_KEY) {
      return process.env.COMPLYADVANTAGE_API_KEY
    }
    return (await getSecretByName('complyAdvantageCreds')).apiKey
  }

  public async refreshSearch(
    caSearchId: number
  ): Promise<{ newHitsCount: number }> {
    await this.initialize()
    const result =
      await this.sanctionsSearchRepository.getSearchResultByCASearchId(
        caSearchId
      )
    if (!result) {
      logger.error(
        `Cannot find complyadvantage monitored search - ${caSearchId}`
      )
      return { newHitsCount: 0 }
    }
    const response = await this.fetchFullSearchState(caSearchId)

    const newHits = await this.sanctionsHitsRepository.addNewHits(
      result._id,
      response.content?.data?.hits || [],
      result.hitContext
    )

    const parsedResponse = {
      hitsCount: (result.response?.hitsCount ?? 0) + newHits.length,
      rawComplyAdvantageResponse: result.response?.rawComplyAdvantageResponse,
      searchId: result._id,
    }
    await this.sanctionsSearchRepository.saveSearchResult({
      request: result.request,
      response: parsedResponse,
      createdAt: result.createdAt,
      updatedAt: Date.now(),
      hitContext: result.hitContext,
    })

    logger.info(
      `Updated monitored search (search ID: ${caSearchId}) for tenant ${this.tenantId}`
    )

    return { newHitsCount: newHits.length }
  }

  public async search(
    request: SanctionsSearchRequest,
    context?: SanctionsHitContext & {
      isOngoingScreening?: boolean
    }
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()

    // Normalize search term
    request.searchTerm = startCase(request.searchTerm.toLowerCase())
    if (
      !request.searchTerm ||
      (request.yearOfBirth &&
        (request.yearOfBirth < 1900 || request.yearOfBirth > dayjs().year()))
    ) {
      return { hitsCount: 0, searchId: 'invalid_search' }
    }

    request.fuzziness = this.getSanitizedFuzziness(request.fuzziness)
    request.types = request.types?.length
      ? request.types
      : SANCTIONS_SEARCH_TYPES

    let searchId: string = uuidv4()
    let createdAt: number | undefined = undefined

    const existedSearch =
      await this.sanctionsSearchRepository.getSearchResultByParams(request)
    let rawComplyAdvantageResponse

    if (!existedSearch?.response) {
      const searchProfileId =
        this.complyAdvantageSearchProfileId ||
        this.pickSearchProfileId(request.types) ||
        (process.env.COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string)
      rawComplyAdvantageResponse = await this.complyAdvantageApi.postSearch(
        searchProfileId,
        {
          ...request,
        }
      )
      const caSearchRef = rawComplyAdvantageResponse.content?.data?.ref
      if (caSearchRef == null) {
        throw new Error(`Unable to get search ref from CA raw response`)
      }
      if (rawComplyAdvantageResponse.content?.data?.hits != null) {
        const restHits = await this.fetchAllHits(caSearchRef, 2)
        rawComplyAdvantageResponse = {
          ...rawComplyAdvantageResponse,
          content: {
            ...rawComplyAdvantageResponse.content,
            data: {
              ...rawComplyAdvantageResponse.content.data,
              hits: [
                ...rawComplyAdvantageResponse.content.data.hits,
                ...restHits,
              ],
            },
          },
        }
      }
    } else {
      createdAt = existedSearch?.createdAt
      searchId = existedSearch.response.searchId
      rawComplyAdvantageResponse =
        existedSearch.response.rawComplyAdvantageResponse
    }

    const filteredHits =
      await this.sanctionsHitsRepository.filterWhitelistedHits(
        rawComplyAdvantageResponse?.content?.data?.hits ?? [],
        context
      )

    const response = {
      rawComplyAdvantageResponse,
      searchId,
      hitsCount: filteredHits.length,
    }

    if (!existedSearch) {
      await this.sanctionsSearchRepository.saveSearchResult({
        createdAt: createdAt,
        request,
        response,
        searchedBy: !context ? getContext()?.user?.id : undefined,
        hitContext: context,
      })
    }

    if (!existedSearch?.response && request.monitoring) {
      await this.updateSearch(searchId, request.monitoring)
    }

    if (context && context.ruleInstanceId) {
      // Save the screening details check when running a rule
      const details: SanctionsScreeningDetails = {
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
        details
      )
      if (context.iban) {
        await this.sanctionsScreeningDetailsRepository.addSanctionsScreeningDetails(
          {
            ...details,
            name: context.iban,
            entity: 'IBAN',
          }
        )
      }
    }
    return response
  }

  public createHitsForSearch(
    search: SanctionsSearchResponse,
    hitContext: SanctionsHitContext | undefined
  ): Promise<SanctionsHit[]> {
    return this.sanctionsHitsRepository.addHits(
      search.searchId,
      search?.rawComplyAdvantageResponse?.content?.data?.hits ?? [],
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

  private async fetchFullSearchState(
    searchId: number
  ): Promise<ComplyAdvantageSearchResponse> {
    const detailsResponse = await this.complyAdvantageApi.getSearchDetails(
      searchId
    )
    const searchRef = detailsResponse.content?.data?.ref
    if (searchRef == null) {
      throw new Error(`Unable to find searchRef for in search response`)
    }
    return {
      ...detailsResponse,
      content: {
        ...detailsResponse.content,
        data: {
          ...detailsResponse.content?.data,
          hits: [
            ...(detailsResponse.content?.data?.hits ?? []),
            ...(await this.fetchAllHits(searchRef, 2)),
          ],
        },
      },
    }
  }

  private async fetchAllHits(
    searchRef: string,
    startPage: number = 1
  ): Promise<ComplyAdvantageSearchHit[]> {
    const hits: ComplyAdvantageSearchHit[] = []
    if (searchRef != null) {
      let page = startPage
      do {
        const entities = await this.complyAdvantageApi.getSearchEntities(
          searchRef,
          {
            page,
          }
        )
        page++
        const newHits = entities.content?.map(convertEntityToHit) ?? []
        hits.push(...newHits)
        if (newHits.length === 0) {
          break
        }
      } while (page < 100)
    }
    return hits
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
    const result = await this.sanctionsSearchRepository.getSearchResult(
      searchId
    )

    return result
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

  public async getSearchHistoriesByIds(
    searchIds: string[]
  ): Promise<SanctionsSearchHistory[]> {
    await this.initialize()
    return this.sanctionsSearchRepository.getSearchResultByIds(searchIds)
  }

  public async updateSearch(
    searchId: string,
    update: SanctionsSearchMonitoring
  ): Promise<void> {
    await this.initialize()
    const search = await this.getSearchHistory(searchId)
    if (!search) {
      logger.error(`Cannot find search ${searchId}. Skip updating search.`)
      return
    }
    const caSearchId =
      search.response?.rawComplyAdvantageResponse?.content?.data?.id
    if (caSearchId == null) {
      throw new Error(`Unable to get search id from response`)
    }
    await this.complyAdvantageApi.patchMonitors(caSearchId, update)

    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
    )
  }

  public async dangerousDeleteComplyAdvantageSearch(
    caSearchId: number
  ): Promise<void> {
    await this.initialize()
    await this.complyAdvantageApi.deleteSearch(caSearchId)
  }

  private pickSearchProfileId(types: SanctionsSearchType[] = []) {
    const profiles =
      SEARCH_PROFILE_IDS[envIs('prod') ? 'prod' : 'sandbox'][
        this.complyAdvantageMarketType ?? 'EMERGING'
      ]
    const key = getSearchTypesKey(types)
    const profileId = profiles[key]

    if (!profileId) {
      logger.error(`Cannot find search profile for types ${types}`)
    }

    return profileId
  }

  public async addWhitelistEntities(
    caEntities: ComplyAdvantageSearchHitDoc[],
    userId?: string,
    options?: {
      reason?: string
      comment?: string
      createdAt?: number
    }
  ) {
    await this.initialize()
    await this.sanctionsWhitelistEntityRepository.addWhitelistEntities(
      caEntities,
      userId,
      options
    )
  }

  public async removeWhitelistEntities(
    caEntityIds: string[],
    userId?: string
  ): Promise<void> {
    await this.initialize()
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(
      caEntityIds,
      userId
    )
  }

  public async searchWhitelistEntities(
    params: {
      filterUserId?: string[]
    } & CursorPaginationParams
  ): Promise<CursorPaginationResponse<SanctionsWhitelistEntity>> {
    await this.initialize()
    return this.sanctionsWhitelistEntityRepository.searchWhitelistEntities(
      params
    )
  }

  public async deleteWhitelistRecord(
    caEntityId: string,
    userId: string
  ): Promise<void> {
    await this.initialize()
    await this.sanctionsWhitelistEntityRepository.removeWhitelistEntities(
      [caEntityId],
      userId
    )
  }

  /*
    Methods to work with hits
   */
  public async searchHits(
    params: {
      filterHitIds?: string[]
      filterSearchId?: string[]
      filterStatus?: SanctionsHitStatus[]
    } & CursorPaginationParams
  ): Promise<SanctionsHitListResponse> {
    await this.initialize()
    const hits = await this.sanctionsHitsRepository.searchHits(params)
    return hits
  }

  public async updateHits(
    sanctionsHitIds: string[],
    updates: SanctionHitStatusUpdateRequest
  ): Promise<{ modifiedCount: number }> {
    await this.initialize()
    const { modifiedCount } =
      await this.sanctionsHitsRepository.updateHitsByIds(sanctionsHitIds, {
        status: updates.status,
      })
    // todo: add audit log record
    return { modifiedCount }
  }
}

/*
  Helpers
 */
export function convertEntityToHit(
  entity: ComplyAdvantageEntity
): ComplyAdvantageSearchHit {
  return {
    doc: {
      id: entity.id,
      aka: entity.key_information?.aka,
      entity_type: entity.key_information?.entity_type,
      fields: Object.values(entity.full_listing ?? {}).flatMap((items) =>
        Object.values(items ?? {}).flatMap((item) => item?.data ?? [])
      ),
      keywords: entity.uncategorized?.keywords,
      last_updated_utc: entity.last_updated_utc
        ? new Date(entity.last_updated_utc)
        : undefined,
      media: entity.uncategorized?.media,
      name: entity.key_information?.name,
      source_notes: entity.key_information?.source_notes,
      sources: entity.key_information?.sources,
      types: entity.key_information?.types,
    },
    match_types: entity.key_information?.match_types,
  }
}
