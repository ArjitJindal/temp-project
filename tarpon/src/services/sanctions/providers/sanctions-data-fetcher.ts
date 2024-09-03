import {
  Entity,
  SanctionsDataProvider,
  SanctionsDataProviderName,
  SanctionsProviderResponse,
  SanctionsProviderSearchRequest,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'

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

    const results = await client
      .db()
      .collection(SANCTIONS_COLLECTION)
      .aggregate<Entity>([
        {
          $search: {
            index: 'sanctions_search_index',
            text: {
              query: request.searchTerm,
              path: {
                wildcard: '*',
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
      ])
      .toArray()

    // TODO implement providerSearchId
    // TODO unify ComplyAdvantageSearchHit and Entity type
    return {
      hitsCount: results.length,
      data: results.map(
        (entity: Entity): ComplyAdvantageSearchHit => ({
          doc: {
            id: entity.id,
            name: entity.name,
            entity_type: entity.entityType,
            aka: entity.aka.map((aka) => ({ name: aka })),
            fields: [
              {
                name: 'Place of birth',
                value: entity.placeOfBirth,
              },
              {
                name: 'Country of residence',
                value: entity.countryOfResidence,
              },
              {
                name: 'Reason',
                value: entity.reason,
              },
              {
                name: 'Original place of birth text',
                value: entity.originalPlaceOfBirthText,
              },
              {
                name: 'Related URL',
                value: entity.relatedURL,
              },
              {
                name: 'Function',
                value: entity.function,
              },
              {
                name: 'Issuing authority',
                value: entity.issuingAuthority,
              },
              {
                name: 'Registration number',
                value: entity.registrationNumber,
              },
              {
                name: 'Other information',
                value: entity.otherInformation,
              },
            ],
          },
        })
      ),
      providerSearchId: 'PROVIDER-SEARCH-ID',
      createdAt: new Date().getTime(),
    }
  }

  provider(): SanctionsDataProviderName {
    return this.providerName
  }

  async getSearch(
    _providerSearchId: string | number
  ): Promise<SanctionsProviderResponse> {
    throw new Error('Method not implemented.')
  }

  async deleteSearch(_providerSearchId: string | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async setMonitoring(
    _providerSearchId: string | number,
    _monitor: boolean
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
