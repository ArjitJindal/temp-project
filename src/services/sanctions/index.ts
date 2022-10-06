import { v4 as uuidv4 } from 'uuid'
import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import { NotFound } from 'http-errors'
import { StackConstants } from '@cdk/constants'
import { SanctionsSearchRepository } from './repositories/sanctions-search-repository'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'
import { ComplyAdvantageSearchResponse } from '@/@types/openapi-internal/ComplyAdvantageSearchResponse'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DefaultApiGetSanctionsSearchRequest } from '@/@types/openapi-internal/RequestParameters'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

const COMPLYADVANTAGE_SEARCH_API_URI =
  'https://api.complyadvantage.com/searches'

const secretsmanager = new AWS.SecretsManager()
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
    const smRes = await secretsmanager
      .getSecretValue({
        SecretId: COMPLYADVANTAGE_CREDENTIALS_SECRET_ARN,
      })
      .promise()
    return JSON.parse(smRes.SecretString as string).apiKey
  }

  public async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsSearchResponse> {
    await this.initPromise
    const searchId = uuidv4()
    const rawComplyAdvantageResponse = (await (
      await fetch(`${COMPLYADVANTAGE_SEARCH_API_URI}?api_key=${this.apiKey}`, {
        method: 'POST',
        body: JSON.stringify({
          search_term: request.searchTerm,
          fuzziness: request.fuzziness,
          filters: {
            country_codes: request.countryCodes,
            birth_year: request.yearOfBirth,
          },
        }),
      })
    ).json()) as ComplyAdvantageSearchResponse
    const hits = rawComplyAdvantageResponse.content?.data?.hits || []
    const response = {
      total: hits.length,
      data: hits,
      searchId,
      rawComplyAdvantageResponse,
    }
    await this.sanctionsSearchRepository.saveSearchResult(
      { ...request, _id: searchId },
      response
    )
    return response
  }

  public async getSearchHistory(
    params: DefaultApiGetSanctionsSearchRequest
  ): Promise<SanctionsSearchHistory[]> {
    await this.initPromise
    return this.sanctionsSearchRepository.getSearchHistory(params)
  }

  public async getSearchResult(
    searchId: string
  ): Promise<SanctionsSearchHistory> {
    await this.initPromise
    const result = await this.sanctionsSearchRepository.getSearchResult(
      searchId
    )
    if (!result) {
      throw new NotFound(`Unable to find search result by searchId=${searchId}`)
    }
    return result
  }
}
