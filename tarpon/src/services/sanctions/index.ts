import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import { NotFound } from 'http-errors'
import { StackConstants } from '@lib/constants'
import _ from 'lodash'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { ComplyAdvantageSearchResponse } from '@/@types/openapi-internal/ComplyAdvantageSearchResponse'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { getSecret } from '@/utils/secrets-manager'
import { SanctionsSearchHistoryResponse } from '@/@types/openapi-internal/SanctionsSearchHistoryResponse'
import { SanctionsSearchMonitoring } from '@/@types/openapi-internal/SanctionsSearchMonitoring'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { logger } from '@/core/logger'

const COMPLYADVANTAGE_SEARCH_API_URI =
  'https://api.complyadvantage.com/searches'

const COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN = process.env
  .COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN as string

export class SanctionsService {
  apiKey!: string
  sanctionsSearchRepository!: SanctionsSearchRepository
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
    this.apiKey = await this.getApiKey()
  }

  private async getApiKey(): Promise<string> {
    if (process.env.COMPLYADVANTAGE_API_KEY) {
      return process.env.COMPLYADVANTAGE_API_KEY
    }
    return (await getSecret<{ apiKey: string }>(
      COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN
    ))!.apiKey
  }

  public async updateMonitoredSearch(caSearchId: number) {
    await this.initialize()
    const result =
      await this.sanctionsSearchRepository.getSearchResultByCASearchId(
        caSearchId
      )
    if (!result?.request) {
      return
    }
    const response = await this.complyAdvantageMonitoredSearch(caSearchId)
    if (response) {
      await this.sanctionsSearchRepository.updateMonitoredSearch(
        caSearchId,
        response
      )
      logger.info(
        `Updated monitored search (search ID: ${caSearchId}) for tenant ${this.tenantId}`
      )
    }
  }

  public async search(
    request: SanctionsSearchRequest,
    defaultSearchProfile?: string
  ): Promise<SanctionsSearchResponse> {
    await this.initialize()

    // Normalize search term
    request.searchTerm = _.startCase(request.searchTerm.toLowerCase())

    const result = await this.sanctionsSearchRepository.getSearchResultByParams(
      request
    )
    if (result?.response) {
      return result?.response
    }

    const searchId = uuidv4()
    const searchProfileId =
      this.pickSearchProfileId(request.types) ||
      defaultSearchProfile ||
      (process.env.COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string)
    const response = await this.complyAdvantageSearch(searchProfileId, {
      ...request,
    })

    const responseWithId = { ...response, searchId }
    await this.sanctionsSearchRepository.saveSearchResult(
      request,
      responseWithId
    )
    if (request.monitoring) {
      await this.updateSearch(searchId, request.monitoring)
    }
    return responseWithId
  }

  private getSanitizedFuzziness(
    fuzziness: number | undefined
  ): number | undefined {
    // Sanization meants retunrning max 1 decimal place
    if (fuzziness == null) {
      return undefined
    }

    return Math.max(Math.round(fuzziness * 10) / 10, 0.1)
  }

  private async complyAdvantageSearch(
    searchProfileId: string,
    request: SanctionsSearchRequest
  ): Promise<Omit<SanctionsSearchResponse, 'searchId'>> {
    const rawComplyAdvantageResponse = (await (
      await fetch(`${COMPLYADVANTAGE_SEARCH_API_URI}?api_key=${this.apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
          search_term: request.searchTerm,
          fuzziness: this.getSanitizedFuzziness(request.fuzziness),
          search_profile: searchProfileId,
          filters: {
            country_codes: request.countryCodes,
            birth_year: request.yearOfBirth,
          },
        }),
      })
    ).json()) as ComplyAdvantageSearchResponse
    if (rawComplyAdvantageResponse.status === 'failure') {
      throw new Error((rawComplyAdvantageResponse as any).message)
    }

    const hits = rawComplyAdvantageResponse.content?.data?.hits || []
    return {
      total: hits.length,
      data: hits,
      rawComplyAdvantageResponse,
    }
  }
  private async complyAdvantageMonitoredSearch(
    searchId: number
  ): Promise<ComplyAdvantageSearchResponse> {
    const rawComplyAdvantageResponse = (await (
      await fetch(
        `${COMPLYADVANTAGE_SEARCH_API_URI}/${searchId}?api_key=${this.apiKey}`,
        {
          method: 'GET',
        }
      )
    ).json()) as ComplyAdvantageSearchResponse
    if (rawComplyAdvantageResponse.status === 'failure') {
      throw new Error((rawComplyAdvantageResponse as any).message)
    }
    return rawComplyAdvantageResponse
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
  ): Promise<SanctionsSearchHistory> {
    await this.initialize()
    const result = await this.sanctionsSearchRepository.getSearchResult(
      searchId
    )
    if (!result) {
      throw new NotFound(
        `Unable to find search history by searchId=${searchId}`
      )
    }
    return result
  }

  public async updateSearch(
    searchId: string,
    update: SanctionsSearchMonitoring
  ): Promise<void> {
    await this.initialize()
    const search = await this.getSearchHistory(searchId)
    const caSearchId =
      search.response?.rawComplyAdvantageResponse?.content?.data?.id
    const monitorResponse = await (
      await fetch(
        `${COMPLYADVANTAGE_SEARCH_API_URI}/${caSearchId}/monitors?api_key=${this.apiKey}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_monitored: update.enabled,
          }),
        }
      )
    ).json()
    if (monitorResponse.status === 'failure') {
      throw new Error(monitorResponse.message)
    }
    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
    )
  }

  private pickSearchProfileId(
    types?: SanctionsSearchType[]
  ): string | undefined {
    if (process.env.ENV !== 'prod') {
      return
    }
    if (_.isEqual(types, ['SANCTIONS'] as SanctionsSearchType[])) {
      return '01c3b373-c01a-48b2-96f7-3fcf17dd0c91'
    } else if (
      _.isEqual(types, ['SANCTIONS', 'PEP'] as SanctionsSearchType[])
    ) {
      return '8b51ca9d-4b45-4de7-bac8-3bebcf6041ab'
    } else if (
      _.isEqual(types, ['SANCTIONS', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
    ) {
      return '919d1abb-2add-46c1-b73a-0fbae79aee6d'
    } else if (_.isEqual(types, ['PEP'] as SanctionsSearchType[])) {
      return 'a9b22101-e5d5-477c-b2c7-2f875ebbd5d8'
    } else if (
      _.isEqual(types, ['PEP', 'ADVERSE_MEDIA'] as SanctionsSearchType[])
    ) {
      return 'e04c41ad-d3f0-4562-9b51-9d00a8965f16'
    } else if (_.isEqual(types, ['ADVERSE_MEDIA'] as SanctionsSearchType[])) {
      return '5a67aa5f-4ec8-4a61-af3a-78e3c132a24d'
    }
  }
}
