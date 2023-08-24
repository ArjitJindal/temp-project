import { v4 as uuidv4 } from 'uuid'
import { StackConstants } from '@lib/constants'

import { isEqual, round, startCase } from 'lodash'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsWhitelistEntityRepository } from './repositories/sanctions-whitelist-entity-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { ComplyAdvantageSearchResponse } from '@/@types/openapi-internal/ComplyAdvantageSearchResponse'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { getSecret } from '@/utils/secrets-manager'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { apiFetch } from '@/utils/api-fetch'

const COMPLYADVANTAGE_SEARCH_API_URI =
  'https://api.complyadvantage.com/searches'

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
    const mongoDb = await getMongoDbClient(
      StackConstants.MONGO_DB_DATABASE_NAME
    )
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      this.tenantId,
      mongoDb
    )
    this.sanctionsWhitelistEntityRepository =
      new SanctionsWhitelistEntityRepository(this.tenantId, mongoDb)
    this.apiKey = await this.getApiKey()

    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    const settings = await tenantRepository.getTenantSettings()
    this.complyAdvantageSearchProfileId =
      settings.complyAdvantageSearchProfileId
  }

  private async getApiKey(): Promise<string> {
    if (process.env.COMPLYADVANTAGE_API_KEY) {
      return process.env.COMPLYADVANTAGE_API_KEY
    }
    return (await getSecret<{ apiKey: string }>(
      process.env.COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN as string
    ))!.apiKey
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
      await this.sanctionsSearchRepository.saveSearchResult(
        result.request,
        getSanctionsSearchResponse(response, result._id),
        result.createdAt,
        Date.now()
      )
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
    }
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()

    // Normalize search term
    request.searchTerm = startCase(request.searchTerm.toLowerCase())
    request.fuzziness = this.getSanitizedFuzziness(request.fuzziness)

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
    await this.sanctionsSearchRepository.saveSearchResult(
      request,
      responseWithId
    )
    if (request.monitoring) {
      await this.updateSearch(searchId, request.monitoring)
    }
    return this.filterOutWhitelistEntites(responseWithId, options?.userId)
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
      return undefined
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

  private pickSearchProfileId(
    types?: SanctionsSearchType[]
  ): string | undefined {
    if (process.env.ENV !== 'prod') {
      return
    }
    if (isEqual(types, ['SANCTIONS'] as SanctionsSearchType[])) {
      return '01c3b373-c01a-48b2-96f7-3fcf17dd0c91'
    } else if (isEqual(types, ['SANCTIONS', 'PEP'] as SanctionsSearchType[])) {
      return '8b51ca9d-4b45-4de7-bac8-3bebcf6041ab'
    } else if (
      isEqual(types, ['SANCTIONS', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
    ) {
      return '919d1abb-2add-46c1-b73a-0fbae79aee6d'
    } else if (isEqual(types, ['PEP'] as SanctionsSearchType[])) {
      return 'a9b22101-e5d5-477c-b2c7-2f875ebbd5d8'
    } else if (
      isEqual(types, ['PEP', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
    ) {
      return 'e04c41ad-d3f0-4562-9b51-9d00a8965f16'
    } else if (isEqual(types, ['ADVERSE_MEDIA'] as SanctionsSearchType[])) {
      return '5a67aa5f-4ec8-4a61-af3a-78e3c132a24d'
    }
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
