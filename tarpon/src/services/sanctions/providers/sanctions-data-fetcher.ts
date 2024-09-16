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

    const maxExpansions = request.fuzziness
      ? (request.fuzziness / 100) * 500
      : 0
    let maxEdits = 0
    if (request.fuzziness) {
      maxEdits = request.fuzziness > 50 ? 2 : 1
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
                maxEdits,
                maxExpansions,
                prefixLength: 0,
              },
            },
          },
        },
        {
          $addFields: {
            score: {
              $meta: 'searchScore',
            },
          },
        },
        {
          $match: match,
        },
        {
          $sort: {
            score: -1,
          },
        },
      ])
      .toArray()

    const providerSearchId = uuidv4()
    const result = {
      providerSearchId,
      hitsCount: results.length,
      data: results,
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
