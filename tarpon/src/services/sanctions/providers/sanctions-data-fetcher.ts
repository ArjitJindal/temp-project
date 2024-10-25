import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'

export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository

  constructor(provider: SanctionsDataProviderName) {
    this.providerName = provider
    this.searchRepository = new SanctionsProviderSearchRepository()
  }

  abstract fullLoad(repo: SanctionsRepository, version: string): Promise<void>

  abstract delta(
    repo: SanctionsRepository,
    version: string,
    from: Date
  ): Promise<void>

  async updateMonitoredSearches() {
    await this.searchRepository.updateMonitoredSearches(this.search.bind(this))
    return
  }

  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const andFilters: string[] = []
    const orFilters: string[] = []

    // Country codes
    if (request.countryCodes) {
      andFilters.push(
        `arrayCount(x -> x IN (${request.countryCodes
          .map((code) => `'${code}'`)
          .join(',')}), countryCodes) > 0`
      )
    }

    // Year of birth
    if (request.yearOfBirth) {
      const yearOfBirthClause = `
      (toString(yearOfBirth) = '${request.yearOfBirth}' OR yearOfBirth IS NULL OR yearOfBirth = '')
    `
      if (request.orFilters?.includes('yearOfBirth')) {
        orFilters.push(yearOfBirthClause)
      } else {
        andFilters.push(yearOfBirthClause)
      }
    }

    // Types (sanction types or associates' types)
    if (request.types) {
      const typeClause = `arrayCount(x -> x IN (${request.types
        .map((id) => `'${id}'`)
        .join(',')}), sanctionSearchTypes) > 0`

      if (request.orFilters?.includes('types')) {
        orFilters.push(typeClause)
      } else {
        andFilters.push(typeClause)
      }
    }

    // Document ID
    if (request.documentId) {
      const documentClause = `arrayCount(x -> x IN (${request.documentId
        .map((id) => `'${id}'`)
        .join(',')}), documentIds) > 0`

      if (request.orFilters?.includes('documentId')) {
        orFilters.push(documentClause)
        andFilters.push('documentIds is not null AND length(documentIds) > 0')
      } else {
        andFilters.push(documentClause)
      }
    }

    // Nationality
    if (request.nationality && request.nationality.length > 0) {
      const nationalityClause = `(arrayCount(x -> x IN (${[
        ...request.nationality,
        'XX',
        'ZZ',
      ]
        .map((id) => `'${id}'`)
        .join(
          ','
        )}), nationality) > 0) OR nationality IS NULL OR length(nationality) = 0`
      if (request.orFilters?.includes('nationality')) {
        orFilters.push(nationalityClause)
      } else {
        andFilters.push(nationalityClause)
      }
    }

    // Occupation Code
    if (request.occupationCode) {
      andFilters.push(
        `arrayCount(x -> x IN (${request.occupationCode
          .map((id) => `'${id}'`)
          .join(',')}), occupationCodes) > 0`
      )
    }

    // PEP Rank
    if (request.PEPRank) {
      andFilters.push(`
      has(ranks, '${request.PEPRank}')
    `)
    }

    // Gender
    if (request.gender) {
      const genderClause = `(gender = '${request.gender}' OR gender = 'Unknown' OR gender IS null OR gender = '')`

      if (request.orFilters?.includes('gender')) {
        orFilters.push(genderClause)
      } else {
        andFilters.push(genderClause)
      }
    }

    // Search term fuzzy matching (simulating MongoDB Atlas fuzzy search)
    if (request.searchTerm) {
      let fuzzinessThreshold = 0
      if (request.fuzzinessRange?.upperBound) {
        fuzzinessThreshold = request.fuzzinessRange?.upperBound
      }
      if (request.fuzziness) {
        fuzzinessThreshold = request.fuzziness * 100
      }
      const allowedDifference = fuzzinessThreshold / 100
      andFilters.push(`
    arrayExists(item -> (editDistance(lower(item), '${request.searchTerm.toLowerCase()}') / greatest(length(lower(item)), length('${request.searchTerm.toLowerCase()}'))) <= ${allowedDifference}, arrayConcat([name], aka))
  `)
    }

    // Construct the final query
    const query = `
    SELECT
       argMax(data, timestamp) AS data,
       max(timestamp) AS latest_timestamp
    FROM
      sanctions_data
    ${andFilters.length || orFilters.length ? 'WHERE' : ''}
    ${andFilters.join(' AND ')}
    ${andFilters.length && orFilters.length ? 'AND' : ''}
    ${orFilters.length ? `(${orFilters.join(' OR ')})` : ''}
    GROUP BY id, provider
    LIMIT 500
  `
    // Execute the query
    const results = await executeClickhouseQuery<{ data: string }>(
      'flagright',
      query,
      {}
    )
    const filteredResults = results.map(
      (r) => JSON.parse(r.data) as SanctionsEntity
    )
    return this.searchRepository.saveSearch(filteredResults, request)
  }

  provider(): SanctionsDataProviderName {
    return this.providerName
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    return this.searchRepository.getSearchResult(providerSearchId)
  }

  async deleteSearch(providerSearchId: string): Promise<void> {
    await this.searchRepository.deleteSearchResult(providerSearchId)
  }

  async setMonitoring(
    providerSearchId: string,
    monitor: boolean
  ): Promise<void> {
    await this.searchRepository.setMonitoring(providerSearchId, monitor)
  }
}
