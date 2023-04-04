import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import { NotFound } from 'http-errors'
import { StackConstants } from '@cdk/constants'
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

const COMPLYADVANTAGE_SEARCH_API_URI =
  'https://api.complyadvantage.com/searches'

const COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN = process.env
  .COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN as string

export class SanctionsService {
  initPromise: Promise<void>
  apiKey!: string
  sanctionsSearchRepository!: SanctionsSearchRepository

  constructor(tenantId: string) {
    this.initPromise = this.initialize(tenantId)
  }

  private async initialize(tenantId: string) {
    const mongoDb = await getMongoDbClient(
      StackConstants.MONGO_DB_DATABASE_NAME
    )
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      tenantId,
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

  public async search(
    request: SanctionsSearchRequest,
    searchProfile?: string
  ): Promise<SanctionsSearchResponse> {
    await this.initPromise
    const searchId = uuidv4()
    const searchProfileId =
      searchProfile || process.env.COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID
    const rawComplyAdvantageResponse = (await (
      await fetch(`${COMPLYADVANTAGE_SEARCH_API_URI}?api_key=${this.apiKey}`, {
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
      })
    ).json()) as ComplyAdvantageSearchResponse
    if (rawComplyAdvantageResponse.status === 'failure') {
      throw new Error((rawComplyAdvantageResponse as any).message)
    }
    const hits = rawComplyAdvantageResponse.content?.data?.hits || []
    const response = {
      total: hits.length,
      data: hits,
      searchId,
      rawComplyAdvantageResponse,
    }
    await this.sanctionsSearchRepository.saveSearchResult(
      searchId,
      request,
      response
    )
    if (request.monitoring) {
      await this.updateSearch(searchId, request.monitoring)
    }
    return response
  }

  public async getSearchHistories(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistoryResponse> {
    // TODO: also based on params, filter return results based on dates
    await this.initPromise
    return this.sanctionsSearchRepository.getSearchHistory(params)
  }

  public async getSearchHistory(
    searchId: string
  ): Promise<SanctionsSearchHistory> {
    await this.initPromise
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
    await this.initPromise
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

    // TODO: Handle webhook
    // https://www.notion.so/flagright/Public-Sanctions-API-webhook-0a696f9644cc4185a132451058b1984b?pvs=4
    if (update.webhookUrl) {
      // register webhook
    } else {
      // deregister webhook
    }
    await this.sanctionsSearchRepository.updateSearchMonitoring(
      searchId,
      update
    )
  }
}
