import { v4 as uuidv4 } from 'uuid'
import { Collection } from 'mongodb'
import {
  SanctionsDataProvider,
  SanctionsDataProviderName,
  SanctionsProviderResponse,
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
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'

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

  async updateMonitoredSearches() {
    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()

    for await (const monitoredSearch of sanctionsProviderCollection.find({
      monitor: true,
    })) {
      if (monitoredSearch.providerSearchId && monitoredSearch.request) {
        await this.search({
          existingProviderId: monitoredSearch.providerSearchId,
          ...monitoredSearch.request,
        })
      }
    }
  }
  private getFuzzinessEvaluationResult(
    request: SanctionsSearchRequest,
    percentageSimilarity: number
  ): boolean {
    if (
      request.fuzzinessRange?.lowerBound &&
      request.fuzzinessRange?.upperBound
    ) {
      const { lowerBound, upperBound } = request.fuzzinessRange
      return (
        percentageSimilarity >= lowerBound && percentageSimilarity <= upperBound
      )
    }
    return request.fuzziness
      ? percentageSimilarity <= request.fuzziness * 100
      : false
  }
  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const client = await getMongoDbClient()
    const match = {}

    if (request.countryCodes) {
      match['countryCodes'] = { $in: request.countryCodes }
    }
    let yearOfBirthMatch
    if (request.yearOfBirth) {
      yearOfBirthMatch = [
        {
          compound: {
            should: [
              {
                text: {
                  query: `${request.yearOfBirth}`,
                  path: 'yearOfBirth',
                },
              },
              {
                equals: {
                  value: null,
                  path: 'yearOfBirth',
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      ]
    }
    let matchTypes: { text: { query: SanctionsSearchType; path: string } }[] =
      []
    if (request.types) {
      matchTypes = request.types.flatMap((type) => [
        {
          text: {
            query: type,
            path: 'sanctionSearchTypes',
          },
        },
        {
          text: {
            query: type,
            path: 'associates.sanctionSearchTypes',
          },
        },
      ])
    }
    let documentIdMatch
    if (request.documentId) {
      documentIdMatch = [
        {
          compound: {
            should: request.documentId.map((docId) => ({
              text: {
                query: docId,
                path: 'documents.id',
              },
            })),
            mustNot: [
              {
                equals: {
                  value: null,
                  path: 'documents.id',
                },
              },
            ],
            minimumShouldMatch: request.documentId.length > 0 ? 1 : 0,
          },
        },
      ]
    }
    let nationalityMatch
    if (request.nationality) {
      nationalityMatch = [
        {
          compound: {
            should: [
              ...request.nationality.map((nationality) => ({
                text: {
                  query: nationality,
                  path: 'nationality',
                },
              })),
              {
                equals: {
                  value: null,
                  path: 'nationality',
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      ]
    }

    if (request.occupationCode) {
      match['occupations.occupationCode'] = { $in: request.occupationCode }
    }

    let ranksMatch
    if (request.PEPRank) {
      ranksMatch = [
        {
          compound: {
            should: [
              {
                text: {
                  query: request.PEPRank,
                  path: 'occupations.ranks',
                },
              },
              {
                text: {
                  query: request.PEPRank,
                  path: 'associates.ranks',
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      ]
    }

    const results = await client
      .db()
      .collection(SANCTIONS_COLLECTION)
      .aggregate<SanctionsEntity>([
        {
          $search: {
            index: 'sanctions_search_index',
            concurrent: true,
            compound: {
              must: [
                {
                  text: {
                    query: request.searchTerm,
                    path: ['name', 'aka'],
                    fuzzy: {
                      maxEdits: 2,
                      maxExpansions: 100,
                      prefixLength: 0,
                    },
                  },
                },
              ],
              filter: [
                ...(yearOfBirthMatch ?? []),
                {
                  compound: {
                    should: matchTypes,
                    minimumShouldMatch: 1,
                  },
                },
                ...(nationalityMatch ?? []),
                ...(ranksMatch ?? []),
                ...(documentIdMatch ?? []),
              ],
            },
          },
        },
        {
          $addFields: {
            searchScore: { $meta: 'searchScore' },
          },
        },
        {
          // A minumum searchScore of 3 was encountered by trial and error
          // whilst using atlas search console
          $match: { ...match, searchScore: { $gt: 3 } },
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
        const fuzzyMatch = this.getFuzzinessEvaluationResult(
          request,
          percentageSimilarity
        )

        const exactMatch =
          value.toLowerCase() === request.searchTerm.toLowerCase()
        return fuzzyMatch || exactMatch
      }
    })

    const providerSearchId = request.existingProviderId || uuidv4()
    const result = {
      providerSearchId,
      hitsCount: filteredResults.length,
      data: filteredResults,
      createdAt: new Date().getTime(),
    }

    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.updateOne(
      { providerSearchId },
      { $set: request },
      {
        upsert: true,
      }
    )
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
    providerSearchId: string,
    monitor: boolean
  ): Promise<void> {
    const sanctionsProviderCollection =
      await this.getSanctionProviderCollection()
    await sanctionsProviderCollection.updateOne(
      {
        providerSearchId,
      },
      {
        $set: {
          monitor,
        },
      }
    )
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
