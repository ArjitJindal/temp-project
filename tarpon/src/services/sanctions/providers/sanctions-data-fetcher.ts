import { getNameMatches, getSecondaryMatches } from './utils'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import {
  DELTA_SANCTIONS_COLLECTION,
  SANCTIONS_COLLECTION,
  getSearchIndexName,
} from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
import { traceable } from '@/core/xray'
import { SanctionsMatchTypeDetails } from '@/@types/openapi-internal/SanctionsMatchTypeDetails'

@traceable
export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository
  private readonly tenantId: string

  constructor(provider: SanctionsDataProviderName, tenantId: string) {
    this.providerName = provider
    this.searchRepository = new SanctionsProviderSearchRepository()
    this.tenantId = tenantId
  }

  abstract fullLoad(repo: SanctionsRepository, version: string): Promise<void>

  abstract delta(
    repo: SanctionsRepository,
    version: string,
    from: Date
  ): Promise<void>

  public static getFuzzinessEvaluationResult(
    request: SanctionsSearchRequest,
    percentageSimilarity: number
  ): boolean {
    const percentageDissimilarity = 100 - percentageSimilarity

    if (
      request.fuzzinessRange?.lowerBound != null &&
      request.fuzzinessRange?.upperBound != null
    ) {
      const { lowerBound, upperBound } = request.fuzzinessRange
      return (
        percentageDissimilarity >= lowerBound &&
        percentageDissimilarity <= upperBound
      )
    }
    return request.fuzziness
      ? percentageDissimilarity <= request.fuzziness * 100
      : false
  }

  private hydrateHitsWithMatchTypes(
    hits: SanctionsEntity[],
    request: SanctionsSearchRequest
  ) {
    return hits.map((hit) => {
      const matchTypes: SanctionsMatchType[] = []

      if (request.types?.some((t) => hit.sanctionSearchTypes?.includes(t))) {
        matchTypes.push('screening_type_match')
      }

      if (
        hit.associates?.length &&
        hit.associates.some((a) =>
          a.sanctionsSearchTypes?.some((t) => request.types?.includes(t))
        )
      ) {
        matchTypes.push('associate_screening_type_match')
      }

      if (
        request.documentId?.length &&
        hit.documents?.length &&
        hit.documents.some(
          (doc) => doc.id && request.documentId?.includes(doc.id)
        )
      ) {
        matchTypes.push('document_id')
      }

      if (
        request.nationality?.length &&
        hit.nationality?.length &&
        request.nationality.some(
          (nationality) =>
            nationality && (hit.nationality as string[])?.includes(nationality)
        )
      ) {
        matchTypes.push('nationality')
      }

      if (
        request.yearOfBirth &&
        hit.yearOfBirth &&
        hit.yearOfBirth == String(request.yearOfBirth)
      ) {
        matchTypes.push('year_of_birth')
      }

      if (request.gender && hit.gender && request.gender === hit.gender) {
        matchTypes.push('gender')
      }

      if (request.searchTerm && hit.name) {
        if (request.searchTerm.toLowerCase() == hit.name.toLowerCase()) {
          matchTypes.push('name_exact')
        } else if (
          hit.aka?.some(
            (aka) => request.searchTerm.toLowerCase() == aka.toLowerCase()
          )
        ) {
          matchTypes.push('aka_exact')
        } else if (
          request.fuzzinessRange?.upperBound &&
          request.fuzzinessRange?.upperBound < 100
        ) {
          matchTypes.push('name_fuzzy')
        }
      }

      if (request.PEPRank && (hit.occupations || hit.associates)?.length) {
        if (
          hit.occupations
            ?.map((occupation) => occupation.rank)
            .includes(request.PEPRank)
        ) {
          matchTypes.push('PEP_rank')
        }
        if (
          hit.associates
            ?.flatMap((associate) => associate?.ranks ?? [])
            .includes(request.PEPRank)
        ) {
          matchTypes.push('associate_PEP_rank')
        }
      }
      if (
        request.isActivePep &&
        (hit.isActivePep === true || hit.isActivePep === null) &&
        hit.sanctionSearchTypes?.includes('PEP')
      ) {
        matchTypes.push('is_active_pep')
      }
      if (
        request.isActiveSanctioned &&
        (hit.isActiveSanctioned === true || hit.isActiveSanctioned === null) &&
        hit.sanctionSearchTypes?.includes('SANCTIONS')
      ) {
        matchTypes.push('is_active_sanctioned')
      }
      return {
        ...hit,
        matchTypes,
      }
    })
  }

  async searchWithoutMatchingNames(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const db = await getMongoDbClientDb()
    const andConditions: any[] = []
    const orConditions: any[] = []
    if (request.types) {
      const matchTypeCondition = {
        $or: [
          {
            sanctionSearchTypes: request.types,
          },
          {
            'associates.sanctionsSearchTypes': request.types,
          },
        ],
      }
      if (request.orFilters?.includes('types')) {
        orConditions.push(matchTypeCondition)
      } else {
        andConditions.push(matchTypeCondition)
      }
    }
    if (request.documentId && request.allowDocumentMatches) {
      const matchDocumentCondition = request.documentId.length
        ? {
            $or: [
              {
                'documents.id': {
                  $in: request.documentId,
                },
              },
              {
                'documents.formattedId': {
                  $in: request.documentId,
                },
              },
            ],
          }
        : {
            $and: [
              {
                'documents.id': '__no_match__',
              },
              {
                'documents.formattedId': '__no_match__',
              },
            ],
          }
      if (request.orFilters?.includes('documentId')) {
        orConditions.push(matchDocumentCondition)
      } else {
        andConditions.push(matchDocumentCondition)
      }
    }
    if (!request.allowDocumentMatches && request.documentId?.length) {
      andConditions.push({
        $and: [
          {
            'documents.id': {
              $nin: request.documentId,
            },
          },
          {
            'documents.formattedId': {
              $nin: request.documentId,
            },
          },
        ],
      })
    }
    if (request.nationality) {
      const matchNationalityCondition = {
        nationality: {
          $in: [...request.nationality, 'XX', 'ZZ'],
        },
      }
      if (request.orFilters?.includes('nationality')) {
        orConditions.push(matchNationalityCondition)
      } else {
        andConditions.push(matchNationalityCondition)
      }
    }

    if (request.isActivePep) {
      const isActivePepCondition = {
        $or: [
          {
            isActivePep: {
              $in: [true, null],
            },
          },
          {
            sanctionsSearchTypes: {
              $ne: 'PEP',
            },
          },
        ],
      }
      if (request.orFilters?.includes('isActivePep')) {
        orConditions.push(isActivePepCondition)
      } else {
        andConditions.push(isActivePepCondition)
      }
    }

    if (request.isActiveSanctioned) {
      const isActiveSanctionedCondition = {
        $or: [
          {
            isActiveSanctioned: {
              $in: [true, null],
            },
          },
          {
            sanctionsSearchTypes: {
              $ne: 'SANCTIONS',
            },
          },
        ],
      }
      if (request.orFilters?.includes('isActiveSanctioned')) {
        orConditions.push(isActiveSanctionedCondition)
      } else {
        andConditions.push(isActiveSanctionedCondition)
      }
    }

    if (request.entityType) {
      if (request.orFilters?.includes('entityType')) {
        orConditions.push({
          entityType: request.entityType,
        })
      } else {
        andConditions.push({
          entityType: request.entityType,
        })
      }
    }

    if (request.yearOfBirth) {
      const matchYearOfBirthCondition = {
        yearOfBirth: `${request.yearOfBirth}`,
      }
      if (request.orFilters?.includes('yearOfBirth')) {
        orConditions.push(matchYearOfBirthCondition)
      } else {
        andConditions.push(matchYearOfBirthCondition)
      }
    }
    if (request.gender) {
      const matchGenderCondition = {
        gender: request.gender,
      }
      if (request.orFilters?.includes('gender')) {
        orConditions.push(matchGenderCondition)
      } else {
        andConditions.push(matchGenderCondition)
      }
    }
    if (request.PEPRank) {
      const matchPEPRankCondition = {
        $or: [
          {
            'occupations.rank': request.PEPRank,
          },
          {
            'associates.ranks': request.PEPRank,
          },
        ],
      }
      if (request.orFilters?.includes('PEPRank')) {
        orConditions.push(matchPEPRankCondition)
      } else {
        andConditions.push(matchPEPRankCondition)
      }
    }
    if (orConditions.length === 0 && andConditions.length === 0) {
      throw new Error('Rule configuration must be reviewed')
    }
    const match = {
      ...(orConditions.length > 0 ? { $or: orConditions } : {}),
      ...(andConditions.length > 0 ? { $and: andConditions } : {}),
    }

    const results = await db
      .collection(
        request.isOngoingScreening
          ? DELTA_SANCTIONS_COLLECTION(this.tenantId)
          : SANCTIONS_COLLECTION(this.tenantId)
      )
      .find<SanctionsEntity>(match)
      .toArray()

    return this.searchRepository.saveSearch(
      this.hydrateHitsWithMatchTypes(results, request),
      request
    )
  }

  async searchWithMatchingNames(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const client = await getMongoDbClient()
    const match = {}

    const andFilters: any[] = []
    const orFilters: any[] = []

    if (request.yearOfBirth) {
      const yearOfBirthMatch = [
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
      ]
      if (request.orFilters?.includes('yearOfBirth')) {
        orFilters.push(...yearOfBirthMatch)
      } else {
        andFilters.push({
          compound: {
            should: yearOfBirthMatch,
            minimumShouldMatch: 1,
          },
        })
      }
    }
    if (request.types) {
      const matchTypes = request.types.flatMap((type) => [
        {
          text: {
            query: type,
            path: 'sanctionSearchTypes',
          },
        },
        {
          text: {
            query: type,
            path: 'associates.sanctionsSearchTypes',
          },
        },
      ])
      if (request.orFilters?.includes('types')) {
        orFilters.push(...matchTypes)
      } else {
        andFilters.push({
          compound: {
            should: matchTypes,
            minimumShouldMatch: 1,
          },
        })
      }
    }

    if (
      (request.allowDocumentMatches || request.manualSearch) &&
      request.documentId
    ) {
      const documentIdMatch =
        request.documentId.length > 0
          ? request.documentId.flatMap((docId) => [
              {
                text: {
                  query: docId,
                  path: 'documents.id',
                  matchCriteria: 'all',
                },
              },
              {
                text: {
                  query: docId,
                  path: 'documents.formattedId',
                  matchCriteria: 'all',
                },
              },
            ])
          : [
              {
                text: {
                  query: '__no_match__', // A value that will not match any document
                  path: 'documents.id',
                },
              },
            ]
      if (request.orFilters?.includes('documentId')) {
        orFilters.push(...documentIdMatch)
        andFilters.push({
          mustNot: [
            {
              equals: {
                value: null,
                path: 'documents.id',
              },
            },
          ],
        })
      } else {
        andFilters.push({
          compound: {
            should: documentIdMatch,
            mustNot: [
              {
                equals: {
                  value: null,
                  path: 'documents.id',
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        })
      }
    }

    if (
      !(request.allowDocumentMatches || request.manualSearch) &&
      request.documentId?.length
    ) {
      andFilters.push({
        compound: {
          mustNot: request.documentId.flatMap((docId) => [
            {
              text: {
                query: docId,
                path: 'documents.id',
              },
            },
            {
              text: {
                query: docId,
                path: 'documents.formattedId',
              },
            },
          ]),
        },
      })
    }

    if (request.isActivePep) {
      const activeMatch = [
        {
          compound: {
            should: [
              {
                compound: {
                  should: [
                    {
                      equals: {
                        value: true,
                        path: 'isActivePep',
                      },
                    },
                    {
                      equals: {
                        value: null,
                        path: 'isActivePep',
                      },
                    },
                  ],
                  minimumShouldMatch: 1,
                },
              },
              {
                compound: {
                  mustNot: {
                    equals: {
                      value: 'PEP',
                      path: 'sanctionSearchTypes',
                    },
                  },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      ]
      if (request.orFilters?.includes('isActivePep')) {
        orFilters.push(...activeMatch)
      } else {
        andFilters.push(...activeMatch)
      }
    }

    if (request.isActiveSanctioned) {
      const activeMatch = [
        {
          compound: {
            should: [
              {
                compound: {
                  should: [
                    {
                      equals: {
                        value: true,
                        path: 'isActiveSanctioned',
                      },
                    },
                    {
                      equals: {
                        value: null,
                        path: 'isActiveSanctioned',
                      },
                    },
                  ],
                  minimumShouldMatch: 1,
                },
              },
              {
                compound: {
                  mustNot: {
                    equals: {
                      value: 'SANCTIONS',
                      path: 'sanctionSearchTypes',
                    },
                  },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      ]
      if (request.orFilters?.includes('isActiveSanctioned')) {
        orFilters.push(...activeMatch)
      } else {
        andFilters.push(...activeMatch)
      }
    }

    if (request.entityType) {
      const matchEntityType = [
        {
          text: {
            query: request.entityType,
            path: 'entityType',
          },
        },
      ]
      if (request.orFilters?.includes('entityType')) {
        orFilters.push(...matchEntityType)
      } else {
        andFilters.push({
          compound: {
            should: matchEntityType,
            minimumShouldMatch: 1,
          },
        })
      }
    }

    if (request.nationality && request.nationality.length > 0) {
      const nationalityMatch = [
        ...[...request.nationality, 'XX', 'ZZ'].map((nationality) => ({
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
      ]
      if (request.orFilters?.includes('nationality')) {
        orFilters.push(...nationalityMatch)
      } else {
        andFilters.push({
          compound: {
            should: nationalityMatch,
            minimumShouldMatch: 1,
          },
        })
      }
    }

    if (request.occupationCode) {
      match['occupations.occupationCode'] = { $in: request.occupationCode }
    }
    if (request.PEPRank) {
      andFilters.push({
        compound: {
          should: [
            {
              text: {
                query: request.PEPRank,
                path: 'occupations.rank',
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
      })
    }

    if (request.gender) {
      const genderMatch = [
        {
          text: {
            query: request.gender,
            path: 'gender',
          },
        },
        {
          equals: {
            value: 'Unknown',
            path: 'gender',
          },
        },
      ]
      if (request.orFilters?.includes('gender')) {
        orFilters.push(...genderMatch)
      } else {
        andFilters.push({
          compound: {
            should: genderMatch,
            minimumShouldMatch: 1,
          },
        })
      }
    }
    const searchScoreThreshold =
      request.fuzzinessRange?.upperBound === 100 ? 3 : 7
    const results = await client
      .db()
      .collection(
        request.isOngoingScreening
          ? DELTA_SANCTIONS_COLLECTION(this.tenantId)
          : SANCTIONS_COLLECTION(this.tenantId)
      )
      .aggregate<SanctionsEntity>([
        {
          $search: {
            index: request.isOngoingScreening
              ? getSearchIndexName(DELTA_SANCTIONS_COLLECTION(this.tenantId))
              : getSearchIndexName(SANCTIONS_COLLECTION(this.tenantId)),
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
                ...(orFilters.length > 0
                  ? [
                      {
                        compound: {
                          should: orFilters,
                          minimumShouldMatch: 1,
                        },
                      },
                    ]
                  : []),
                ...andFilters,
              ],
            },
          },
        },
        {
          $limit: 100,
        },
        {
          $addFields: {
            searchScore: { $meta: 'searchScore' },
          },
        },
        {
          // A minumum searchScore of 3 was encountered by trial and error
          // whilst using atlas search console
          $match: {
            ...match,
            searchScore: {
              $gt: request.isOngoingScreening ? 0.5 : searchScoreThreshold,
            },
          },
        },
      ])
      .toArray()

    const searchTerm = request.searchTerm.toLowerCase()
    const filteredResults = this.hydrateHitsWithMatchTypes(
      results.filter((entity) => {
        const values = [entity.name, ...(entity.aka || [])]
        const hasAka = entity.aka && entity.aka.length > 0

        if (request.fuzzinessRange?.upperBound === 100) {
          return true
        } else {
          for (const value of values) {
            if (value.toLowerCase() === searchTerm) {
              return true
            }
          }
        }

        const percentageSimilarity = calculateLevenshteinDistancePercentage(
          request.searchTerm,
          entity.name
        )

        const fuzzyMatch = SanctionsDataFetcher.getFuzzinessEvaluationResult(
          request,
          percentageSimilarity
        )

        if (fuzzyMatch) {
          return true
        }
        return (
          hasAka &&
          SanctionsDataFetcher.getFuzzinessEvaluationResult(
            request,
            Math.max(percentageSimilarity - 10, 0) // Approximation to avoid calculating levenshtein distance for every pair to reduce complexity
          )
        )
      }),
      request
    )

    return this.searchRepository.saveSearch(filteredResults, request)
  }

  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    let result: SanctionsProviderResponse
    if (
      !request.manualSearch &&
      (request.fuzzinessRange?.upperBound === 100 ||
        (request.fuzziness ?? 0) * 100 === 100)
    ) {
      result = await this.searchWithoutMatchingNames(request)
    } else {
      result = await this.searchWithMatchingNames(request)
    }
    return {
      ...result,
      data: result.data?.map(
        (entity: SanctionsEntity): SanctionsEntity => ({
          ...entity,
          matchTypeDetails: [
            SanctionsDataFetcher.deriveMatchingDetails(request, entity),
          ],
        })
      ),
    }
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

  public static deriveMatchingDetails(
    searchRequest: SanctionsSearchRequest,
    entity: SanctionsEntity
  ): SanctionsMatchTypeDetails {
    // Calculate name matches
    const nameMatches = getNameMatches(entity, searchRequest)

    // Calculate year matches
    const secondaryMatches = getSecondaryMatches(entity, searchRequest)

    return {
      amlTypes: [],
      matchingName: entity.name,
      nameMatches: nameMatches,
      secondaryMatches: secondaryMatches,
      sources: [],
    }
  }
}
