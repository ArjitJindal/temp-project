import { v4 as uuidv4 } from 'uuid'
import { Collection } from 'mongodb'
import {
  SanctionsDataProvider,
  SanctionsDataProviderName,
  SanctionsProviderResponse,
  SanctionsProviderSearchRequest,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'

export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName

  constructor(provider: SanctionsDataProviderName) {
    this.providerName = provider
  }

  abstract fullLoad(repo: SanctionsRepository, version: string): Promise<void>

  abstract delta(
    repo: SanctionsRepository,
    version: string,
    from: Date
  ): Promise<void>

  async search(
    request: SanctionsProviderSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const client = await getMongoDbClient()
    const match = {}

    if (request.countryCodes) {
      match['countryCodes'] = { $in: request.countryCodes }
    }

    if (request.yearOfBirth) {
      match['yearOfBirth'] = `${request.yearOfBirth}`
    }

    if (request.types) {
      match['sanctionSearchTypes'] = { $in: request.types }
    }

    if (request.documentId) {
      match['documents.id'] = { $in: request.documentId }
    }

    if (request.nationality) {
      match['nationality'] = { $in: request.nationality }
    }

    if (request.occupationCode) {
      match['occupations.occupationCode'] = { $in: request.occupationCode }
    }

    const results = await client
      .db()
      .collection(SANCTIONS_COLLECTION)
      .aggregate<SanctionsEntity>([
        {
          $search: {
            index: 'sanctions_search_index',
            text: {
              query: request.searchTerm,
              path: {
                wildcard: '*',
              },
              fuzzy: {
                maxEdits: 2,
                maxExpansions: 100,
                prefixLength: 0,
              },
            },
          },
        },
        {
          $match: match,
        },
        {
          $limit: 10,
        },
      ])
      .toArray()

    const filteredResults = results.filter((entity) => {
      const values = [...(entity.aka || []), entity.name]
      for (const value of values) {
        const percentageSimilarity = calculateLevenshteinDistancePercentage(
          request.searchTerm,
          value
        )
        const fuzzyMatch =
          request.fuzziness && percentageSimilarity <= request.fuzziness * 100

        const exactMatch =
          value.toLowerCase() === request.searchTerm.toLowerCase()
        return fuzzyMatch || exactMatch
      }
    })

    const providerSearchId = uuidv4()
    const result = {
      providerSearchId,
      hitsCount: filteredResults.length,
      data: filteredResults,
      createdAt: new Date().getTime(),
    }

    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.insertOne(result)
    return result
  }

  provider(): SanctionsDataProviderName {
    return this.providerName
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    const result = await (
      await this.getSanctionProviderCollection()
    ).findOne({
      providerSearchId: providerSearchId,
    })

    if (!result) {
      throw new Error(`Search not found for ${providerSearchId}`)
    }
    return result
  }

  async deleteSearch(providerSearchId: string): Promise<void> {
    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.deleteOne({
      providerSearchId: providerSearchId,
    })
  }

  async setMonitoring(
    _providerSearchId: string,
    _monitor: boolean
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  private async getSanctionProviderCollection(): Promise<
    Collection<SanctionsProviderResponse>
  > {
    const client = await getMongoDbClient()
    const tenantId = getContext()?.tenantId
    if (!tenantId) {
      throw new Error('No tenant ID')
    }
    return client
      .db()
      .collection(SANCTIONS_PROVIDER_SEARCHES_COLLECTION(tenantId))
  }
}
