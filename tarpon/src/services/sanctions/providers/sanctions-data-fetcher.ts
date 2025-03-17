import { uniq } from 'lodash'
import { token_similarity_sort_ratio } from 'fuzzball'
import { sanitizeString } from '@flagright/lib/utils'
import { getDefaultProviders, getSanctionsCollectionName } from '../utils'
import { SanctionsDataProviders } from '../types'
import {
  getNameMatches,
  getSecondaryMatches,
  sanitizeAcurisEntities,
  sanitizeOpenSanctionsEntities,
} from './utils'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getSearchIndexName } from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
import { traceable } from '@/core/xray'
import { SanctionsMatchTypeDetails } from '@/@types/openapi-internal/SanctionsMatchTypeDetails'
import { getNonDemoTenantId } from '@/utils/tenant'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'

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

  abstract fullLoad(
    repo: SanctionsRepository,
    version: string,
    entityType?: SanctionsEntityType
  ): Promise<void>

  abstract delta(
    repo: SanctionsRepository,
    version: string,
    from: Date,
    entityType?: SanctionsEntityType
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
    return request.fuzziness != null
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
        hit.yearOfBirth.includes(request.yearOfBirth.toString())
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

    if (request.entityType && request.entityType !== 'EXTERNAL_USER') {
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
    const providers = getDefaultProviders()
    const nonDemoTenantId = getNonDemoTenantId(this.tenantId)
    const entityTypes =
      request.entityType === 'EXTERNAL_USER'
        ? ['PERSON', 'BUSINESS', 'BANK']
        : [request.entityType]
    const collectionNames = uniq(
      providers.flatMap((p) => {
        return entityTypes.map((entityType) =>
          getSanctionsCollectionName(
            {
              provider: p,
              entityType: entityType,
            },
            nonDemoTenantId,
            request.isOngoingScreening ? 'delta' : 'full'
          )
        )
      })
    )
    const results = await Promise.all(
      collectionNames.map((c) =>
        db
          .collection<SanctionsEntity>(c)
          .find(match, {
            projection: {
              rawResponse: 0,
            },
          })
          .limit(500)
          .toArray()
      )
    )

    return this.searchRepository.saveSearch(
      this.hydrateHitsWithMatchTypes(results.flat(), request),
      request
    )
  }

  async searchWithMatchingNames(
    request: SanctionsSearchRequest,
    limit: number = 200
  ): Promise<SanctionsProviderResponse> {
    const client = await getMongoDbClient()
    const match = {}
    const providers = getDefaultProviders()
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

    if (request.entityType && request.entityType !== 'EXTERNAL_USER') {
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
    if (request.isOngoingScreening) {
      const matchProvider = providers.flatMap((provider) => ({
        text: {
          query: provider,
          path: 'provider',
        },
      }))
      if (request.orFilters?.includes('provider')) {
        orFilters.push(...matchProvider)
      } else {
        andFilters.push({
          compound: {
            should: matchProvider,
            minimumShouldMatch: 1,
          },
        })
      }
    }
    const searchScoreThreshold =
      request.fuzzinessRange?.upperBound === 100 ? 3 : 5
    const stopwordSet = request.stopwords?.length
      ? new Set(request.stopwords.map((word) => word.toLowerCase()))
      : undefined
    const nonDemoTenantId = getNonDemoTenantId(this.tenantId)
    const entityTypes =
      request.entityType === 'EXTERNAL_USER' || request.manualSearch
        ? ['PERSON', 'BUSINESS', 'BANK']
        : [request.entityType]
    const collectionNames = uniq(
      providers.flatMap((p) => {
        return entityTypes.map((entityType) =>
          getSanctionsCollectionName(
            {
              provider: p,
              entityType: entityType,
            },
            nonDemoTenantId,
            request.isOngoingScreening ? 'delta' : 'full'
          )
        )
      })
    )
    const results = await Promise.all(
      collectionNames.map((c) =>
        client
          .db()
          .collection(c)
          .aggregate<SanctionsEntity>([
            {
              $search: {
                index: getSearchIndexName(c),
                concurrent: true,
                compound: {
                  must: [
                    {
                      text: {
                        query: sanitizeString(request.searchTerm),
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
              $limit: providers.includes(SanctionsDataProviders.DOW_JONES)
                ? limit
                : limit + 50, // Will remove the condition after analysing the effect in latency, because Dow jones is used in prod.
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
            {
              $project: {
                rawResponse: 0,
              },
            },
          ])
          .toArray()
      )
    )
    const fuzzinessSettings = request?.fuzzinessSettings
    const filteredResults = this.hydrateHitsWithMatchTypes(
      this.filterResults(
        results.flat(),
        request,
        fuzzinessSettings,
        stopwordSet
      ),
      request
    )

    return this.searchRepository.saveSearch(filteredResults, request)
  }

  private getFuzzinessFunction(
    fuzzinessSettings: FuzzinessSetting | undefined
  ): (a, b) => number {
    if (fuzzinessSettings?.similarTermsConsideration) {
      return token_similarity_sort_ratio
    }
    return calculateLevenshteinDistancePercentage
  }

  public processNameWithStopwords = (name: string, stopwords?: Set<string>) => {
    if (!stopwords) {
      return name
    }
    const normalizedText = name.replace(/\.(?!\s)/g, '. ')
    const words = normalizedText.split(' ')
    const filteredWords = words.filter((word) => {
      const lowerCaseWord = word.toLowerCase()
      return !stopwords.has(lowerCaseWord)
    })

    return filteredWords.join(' ')
  }

  private filterResults(
    results: SanctionsEntity[],
    request: SanctionsSearchRequest,
    fuzzinessSettings: FuzzinessSetting | undefined,
    stopwordSet: Set<string> | undefined
  ): SanctionsEntity[] {
    const keepSpaces = Boolean(!fuzzinessSettings?.sanitizeInputForFuzziness)
    const shouldSanitizeString =
      fuzzinessSettings?.sanitizeInputForFuzziness ||
      fuzzinessSettings?.similarTermsConsideration

    const modifiedTerm = this.processNameWithStopwords(
      request.searchTerm,
      stopwordSet
    )
      .toLowerCase()
      .trim()
    const searchTerm = shouldSanitizeString
      ? sanitizeString(modifiedTerm, keepSpaces)
      : modifiedTerm

    return results.filter((entity) => {
      const values = uniq([entity.name, ...(entity.aka || [])]).map((name) =>
        this.processNameWithStopwords(name, stopwordSet)
      )
      if (
        request.fuzzinessRange?.upperBound === 100 ||
        request.fuzziness === 1
      ) {
        return true
      } else {
        for (let value of values) {
          if (value.toLowerCase() === searchTerm) {
            return true
          }
          value = shouldSanitizeString
            ? sanitizeString(value, keepSpaces)
            : value
          const evaluatingFunction =
            this.getFuzzinessFunction(fuzzinessSettings)
          const percentageSimilarity = evaluatingFunction(searchTerm, value)
          const fuzzyMatch = SanctionsDataFetcher.getFuzzinessEvaluationResult(
            request,
            percentageSimilarity
          )
          if (fuzzyMatch) {
            return true
          }
        }
      }
      return false
    })
  }

  async search(
    request: SanctionsSearchRequest,
    isMigration?: boolean // TODO: remove this once after migration is done
  ): Promise<SanctionsProviderResponse> {
    let result: SanctionsProviderResponse
    if (
      !request.manualSearch &&
      (request.fuzzinessRange?.upperBound === 100 ||
        (request.fuzziness ?? 0) * 100 === 100)
    ) {
      result = await this.searchWithoutMatchingNames(request)
    } else {
      result = await this.searchWithMatchingNames(
        request,
        isMigration || request.manualSearch ? 500 : 200
      )
    }
    const data = result.data?.map(
      (entity: SanctionsEntity): SanctionsEntity => ({
        ...entity,
        matchTypeDetails: [
          SanctionsDataFetcher.deriveMatchingDetails(request, entity),
        ],
      })
    )
    return {
      ...result,
      data: await this.sanitizeEntities(data),
    }
  }

  private async sanitizeEntities(data: SanctionsEntity[] | undefined) {
    const providers = getDefaultProviders().filter(
      (p) =>
        p === SanctionsDataProviders.OPEN_SANCTIONS ||
        p === SanctionsDataProviders.ACURIS
    )
    if (!providers.length || !data) {
      return data
    }
    const acurisEntities = data.filter(
      (e) => e.provider === SanctionsDataProviders.ACURIS
    )
    const openSanctionsEntities = data.filter(
      (e) => e.provider === SanctionsDataProviders.OPEN_SANCTIONS
    )
    return [
      ...sanitizeAcurisEntities(acurisEntities),
      ...sanitizeOpenSanctionsEntities(openSanctionsEntities),
    ]
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
