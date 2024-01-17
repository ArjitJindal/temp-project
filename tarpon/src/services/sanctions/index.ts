import { v4 as uuidv4 } from 'uuid'
import { round, startCase } from 'lodash'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsWhitelistEntityRepository } from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { ComplyAdvantageSearchResponse } from '@/@types/openapi-internal/ComplyAdvantageSearchResponse'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { getSecretByName } from '@/utils/secrets-manager'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { apiFetch } from '@/utils/api-fetch'
import { SanctionsSearchHistoryMetadata } from '@/@types/openapi-internal/SanctionsSearchHistoryMetadata'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { envIs } from '@/utils/env'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { tenantSettings } from '@/core/utils/context'

const DEFAULT_FUZZINESS = 0.5
const COMPLYADVANTAGE_SEARCH_API_URI =
  'https://api.complyadvantage.com/searches'

function getSearchTypesKey(
  types: SanctionsSearchType[] = SANCTIONS_SEARCH_TYPES
) {
  const searchTypes = types.length ? types : SANCTIONS_SEARCH_TYPES
  return searchTypes.sort().reverse().join('-')
}

const SEARCH_PROFILE_IDS = {
  prod: {
    [getSearchTypesKey(['SANCTIONS'])]: '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
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
  sandbox: {
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
  },
}
function getSanctionsSearchResponse(
  rawComplyAdvantageResponse: ComplyAdvantageSearchResponse,
  searchId: string
): SanctionsSearchResponse {
  const hits = rawComplyAdvantageResponse.content?.data?.hits || []
  return {
    total: hits.length,
    data: hits,
    rawComplyAdvantageResponse,
    searchId,
  }
}

@traceable
export class SanctionsService {
  apiKey!: string
  complyAdvantageSearchProfileId: string | undefined
  sanctionsSearchRepository!: SanctionsSearchRepository
  sanctionsWhitelistEntityRepository!: SanctionsWhitelistEntityRepository
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private async initialize() {
    if (this.apiKey) {
      return
    }
    const mongoDb = await getMongoDbClient()
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, mongoDb)
    this.apiKey = await this.getApiKey()
    const settings = await tenantSettings(this.tenantId)
    this.complyAdvantageSearchProfileId =
      settings.complyAdvantageSearchProfileId
  }

  private async getApiKey(): Promise<string> {
    if (process.env.COMPLYADVANTAGE_API_KEY) {
      return process.env.COMPLYADVANTAGE_API_KEY
    }
    return (await getSecretByName('complyAdvantageCreds'))!.apiKey
  }

  public async updateMonitoredSearch(caSearchId: number) {
    await this.initialize()
    const result =
      await this.sanctionsSearchRepository.getSearchResultByCASearchId(
        caSearchId
      )
    if (!result) {
      return
    }
    const response = await this.complyAdvantageMonitoredSearch(caSearchId)
    if (response) {
      await this.sanctionsSearchRepository.saveSearchResult({
        request: result.request,
        response: getSanctionsSearchResponse(response, result._id),
        createdAt: result.createdAt,
        updatedAt: Date.now(),
      })
      logger.info(
        `Updated monitored search (search ID: ${caSearchId}) for tenant ${this.tenantId}`
      )
    }
  }

  public async search(
    request: SanctionsSearchRequest,
    options?: {
      searchIdToReplace?: string
      userId?: string
      metadata?: SanctionsSearchHistoryMetadata
    }
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()

    // Normalize search term
    request.searchTerm = startCase(request.searchTerm.toLowerCase())
    request.fuzziness = this.getSanitizedFuzziness(request.fuzziness)
    request.types = request.types?.length
      ? request.types
      : SANCTIONS_SEARCH_TYPES

    const result = options?.searchIdToReplace
      ? null
      : await this.sanctionsSearchRepository.getSearchResultByParams(request)

    if (result?.response) {
      return this.filterOutWhitelistEntites(result?.response, options?.userId)
    }

    const searchId = options?.searchIdToReplace ?? uuidv4()
    const searchProfileId =
      this.complyAdvantageSearchProfileId ||
      this.pickSearchProfileId(request.types) ||
      (process.env.COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string)

    const response = await this.complyAdvantageSearch(searchProfileId, {
      ...request,
    })

    const responseWithId = getSanctionsSearchResponse(response, searchId)
    const sanctionsResponse = await this.filterOutWhitelistEntites(
      responseWithId,
      options?.userId
    )
    await this.sanctionsSearchRepository.saveSearchResult({
      request,
      response: responseWithId,
      metadata: options?.metadata,
    })
    if (request.monitoring) {
      await this.updateSearch(searchId, request.monitoring)
    }
    return sanctionsResponse
  }

  private async filterOutWhitelistEntites(
    response: SanctionsSearchResponse,
    userId?: string
  ): Promise<SanctionsSearchResponse> {
    const augmentedResponse = await this.augmentWhitelistEntites(
      response,
      userId
    )
    const filteredData = augmentedResponse.data.filter(
      (d) => !d.doc?.flagrightWhitelistInfo?.whitelisted
    )
    return { ...response, total: filteredData.length, data: filteredData }
  }

  private async augmentWhitelistEntites(
    response: SanctionsSearchResponse,
    userId?: string
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()
    const entityIds = response.data
      .map((d) => d?.doc?.id)
      .filter(Boolean) as string[]
    const [globalWhitelistEntities, userLevelWhitelistEntities] =
      await Promise.all([
        this.sanctionsWhitelistEntityRepository.getWhitelistEntities(entityIds),
        userId
          ? this.sanctionsWhitelistEntityRepository.getWhitelistEntities(
              entityIds,
              userId
            )
          : Promise.resolve([]),
      ])
    const augmentedData: ComplyAdvantageSearchHit[] = response.data.map((d) => {
      const whitelistEntity =
        globalWhitelistEntities.find(
          (entity) => entity.caEntity.id === d.doc?.id
        ) ??
        userLevelWhitelistEntities.find(
          (entity) =>
            entity.caEntity.id === d.doc?.id && entity.userId === userId
        )
      const newData: ComplyAdvantageSearchHit = {
        ...d,
        doc: {
          ...d.doc,
          flagrightWhitelistInfo: whitelistEntity
            ? {
                whitelisted: true,
                reason: whitelistEntity.reason,
                comment: whitelistEntity.comment,
              }
            : undefined,
        },
      }
      return newData
    })
    return {
      ...response,
      data: augmentedData,
    }
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

  private async complyAdvantageSearch(
    searchProfileId: string,
    request: SanctionsSearchRequest
  ): Promise<ComplyAdvantageSearchResponse> {
    const rawComplyAdvantageResponse =
      await apiFetch<ComplyAdvantageSearchResponse>(
        `${COMPLYADVANTAGE_SEARCH_API_URI}`,
        {
          method: 'POST',
          body: JSON.stringify({
            search_term: request.searchTerm,
            fuzziness: request.fuzziness,
            search_profile: searchProfileId,
            filters: {
              country_codes: request.countryCodes,
              birth_year: request.yearOfBirth,
            },
          }),
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        }
      )

    if (rawComplyAdvantageResponse.result.status === 'failure') {
      throw new Error((rawComplyAdvantageResponse as any).message)
    }

    return rawComplyAdvantageResponse.result
  }

  private async complyAdvantageMonitoredSearch(
    searchId: number
  ): Promise<ComplyAdvantageSearchResponse> {
    const rawComplyAdvantageResponse =
      await apiFetch<ComplyAdvantageSearchResponse>(
        `${COMPLYADVANTAGE_SEARCH_API_URI}/${searchId}/details`,
        {
          method: 'GET',
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        }
      )

    if (rawComplyAdvantageResponse.result.status === 'failure') {
      throw new Error((rawComplyAdvantageResponse as any).message)
    }
    return rawComplyAdvantageResponse.result
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
    userId?: string
  ): Promise<SanctionsSearchHistory | null> {
    await this.initialize()
    const result = await this.sanctionsSearchRepository.getSearchResult(
      searchId
    )
    if (result?.response) {
      result.response = await this.augmentWhitelistEntites(
        result?.response,
        userId
      )
    }

    return result
  }

  public async getSanctionsScreeningStats(): Promise<SanctionsScreeningStats> {
    await this.initialize()
    return await this.sanctionsSearchRepository.getSanctionsScreeningStats()
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
      logger.warn(`Cannot find search ${searchId}. Skip updating search.`)
      return
    }
    const caSearchId =
      search.response?.rawComplyAdvantageResponse?.content?.data?.id

    const monitorResponse = await apiFetch<{
      status: 'success' | 'failure'
      message: string
    }>(`${COMPLYADVANTAGE_SEARCH_API_URI}/${caSearchId}/monitors`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_monitored: update.enabled ?? false,
      }),
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    })

    if (monitorResponse.result.status === 'failure') {
      throw new Error(monitorResponse.result.message)
    }
    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
    )
  }

  public async dangerousDeleteComplyAdvantageSearch(
    caSearchId: number
  ): Promise<void> {
    await this.initialize()
    const response = await apiFetch(
      `${COMPLYADVANTAGE_SEARCH_API_URI}/${caSearchId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      }
    )

    if (response.statusCode === 404) {
      logger.warn(`Search ${caSearchId} not found`)
    } else if (response.statusCode === 204) {
      logger.info(`Search ${caSearchId} deleted.`)
    } else {
      throw new Error(
        `Failed to delete: status=${response.statusCode} body=${JSON.stringify(
          response
        )}`
      )
    }
  }

  private pickSearchProfileId(types: SanctionsSearchType[] = []) {
    const profiles = SEARCH_PROFILE_IDS[envIs('prod') ? 'prod' : 'sandbox']
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
}
