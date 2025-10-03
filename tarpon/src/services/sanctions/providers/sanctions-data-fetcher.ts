import cloneDeep from 'lodash/cloneDeep'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import {
  isLatinScript,
  normalize,
  adverseMediaCategoryMap,
  replaceRequiredCharactersWithSpace,
  sanitizeString,
  sanitizeStringWithSpecialCharactersForTokenization,
} from '@flagright/lib/utils'
import { Db, MongoClient } from 'mongodb'
import {
  Search_RequestBody,
  Search_Response,
} from '@opensearch-project/opensearch/api'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { QueryContainer } from '@opensearch-project/opensearch/api/_types/_common.query_dsl'
import { Client } from '@opensearch-project/opensearch/.'
import {
  SanctionsDataProviders,
  SanctionsSearchProps,
  SanctionsSearchPropsWithRequest,
} from '../types'
import { getDefaultProviders } from '../utils'
import {
  deriveMatchingDetails,
  getAggregatedSourceIds,
  getCollectionNames,
  getFuzzinessThreshold,
  getSanctionSourceDetails,
  hydrateHitsWithMatchTypes,
  sanitizeEntities,
} from './utils'
import {
  FuzzinessOptions,
  fuzzy_levenshtein_distance,
  jaro_winkler_distance,
  token_similarity_sort_ratio,
} from '@/utils/fuzzy'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getSearchIndexName } from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { traceable } from '@/core/xray'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { ScreeningProfileService } from '@/services/screening-profile'
import { hasFeature } from '@/core/utils/context'
import { getOpensearchClient } from '@/utils/opensearch-utils'
import { logger } from '@/core/logger'
import { Address } from '@/@types/openapi-public/Address'
import { SanctionsEntityAddress } from '@/@types/openapi-internal/SanctionsEntityAddress'
import { ask } from '@/utils/llms'
import { ModelTier } from '@/utils/llms/base-service'
import { generateHashFromString } from '@/utils/object'
import { getContext } from '@/core/utils/context-storage'
import { formatAddress } from '@/utils/address-formatter'

export const OPENSEARCH_NON_PROJECTED_FIELDS = [
  'rawResponse',
  'aggregatedSourceIds',
]
@traceable
export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository

  protected readonly tenantId: string
  protected readonly mongoDb: MongoClient
  private readonly dynamoDb: DynamoDBDocumentClient
  private readonly opensearchClient?: Client
  constructor(
    provider: SanctionsDataProviderName,
    tenantId: string,
    connections: {
      mongoDb: MongoClient
      dynamoDb: DynamoDBDocumentClient
      opensearchClient?: Client
    }
  ) {
    this.providerName = provider
    this.searchRepository = new SanctionsProviderSearchRepository()
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.opensearchClient = connections.opensearchClient
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
    entityType?: SanctionsEntityType,
    runFullLoad?: boolean
  ): Promise<void>

  public static getFuzzinessEvaluationResult(
    request: SanctionsSearchRequest,
    percentageSimilarity: number
  ): boolean {
    const percentageDissimilarity = 100 - percentageSimilarity
    // If short name matching is enabled, calculate the fuzziness floor
    if (request.enableShortNameMatching) {
      let fuzziness
      if (request.fuzzinessRange?.upperBound != null) {
        fuzziness = request.fuzzinessRange.upperBound / 100
      } else if (request.fuzziness != null) {
        fuzziness = request.fuzziness
      }

      const fuzzinessFloor = Math.floor(100 / (fuzziness * 100))
      const searchTermLength = request.searchTerm?.length ?? 0

      // For names shorter than or equal to the floor, allow at least 1 character mismatch
      if (fuzziness != 0 && searchTermLength <= fuzzinessFloor) {
        // Calculate the effective number of character differences from the percentage.
        const effectiveCharDifferences =
          (percentageDissimilarity / 100) * searchTermLength

        // Round to the nearest whole number to correct for floating-point inaccuracies
        // and check if the number of differences is at most 1.
        return Math.round(effectiveCharDifferences) <= 1
      }
    }

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

  private applySourceCategoryFilters(props: SanctionsSearchProps): any {
    const {
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    } = props
    const conditions: any[] = []
    if (sanctionsCategory && sanctionSourceIds) {
      conditions.push({
        $and: [
          {
            'sanctionsSources.internalId': {
              $in: sanctionSourceIds,
            },
            'sanctionsSources.category': {
              $in: sanctionsCategory,
            },
          },
        ],
      })
    }

    if (pepCategory && pepSourceIds) {
      const orConditions: Array<{
        'pepSources.internalId'?: { $in: string[] }
        types?: string
      }> = [
        {
          'pepSources.internalId': {
            $in: pepSourceIds,
          },
        },
      ]

      // Add PEP by association condition if needed
      if (
        pepSourceIds.some(
          (id) => id === generateHashFromString('pep by association')
        )
      ) {
        orConditions.push({
          types: 'Linked to PEP (PEP by Association)',
        })
      }

      conditions.push({
        $and: [
          {
            $or: orConditions,
          },
          {
            'pepSources.category': {
              $in: pepCategory,
            },
          },
        ],
      })
    }

    if (relCategory && relSourceIds) {
      conditions.push({
        $and: [
          {
            'otherSources.type': 'REGULATORY_ENFORCEMENT_LIST',
            'otherSources.value.category': {
              $in: relCategory,
            },
          },
          {
            'otherSources.value.internalId': {
              $in: relSourceIds,
            },
          },
        ],
      })
    }

    if (adverseMediaCategory) {
      conditions.push({
        'mediaSources.category': {
          $in: adverseMediaCategory.map((r) => adverseMediaCategoryMap[r]),
        },
      })
    }

    return conditions.length > 0 ? { $or: conditions } : {}
  }

  private getNonSearchIndexQuery(props: SanctionsSearchPropsWithRequest): {
    $and?: any[] | undefined
    $or?: any[] | undefined
  } {
    const {
      request,
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    } = props
    const andConditions: any[] = []
    const orConditions: any[] = []
    if (
      request.searchTerm &&
      (request.fuzziness != null ||
        (request.fuzzinessRange?.lowerBound != null &&
          request.fuzzinessRange?.upperBound != null))
    ) {
      const matchTypeCondition = {
        $or: [
          {
            normalizedAka: {
              $in: [
                normalize(request.searchTerm),
                replaceRequiredCharactersWithSpace(
                  normalize(request.searchTerm),
                  true
                ),
              ],
            },
          },
        ],
      }
      if (request.orFilters?.includes('types')) {
        orConditions.push(matchTypeCondition)
      } else {
        andConditions.push(matchTypeCondition)
      }
    }

    const sourceCategoryFilters = this.applySourceCategoryFilters({
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    })
    if (Object.keys(sourceCategoryFilters).length > 0) {
      andConditions.push(sourceCategoryFilters)
    }

    if (request.types && request.types.length > 0) {
      const matchTypeCondition = {
        $or: [
          {
            sanctionSearchTypes: { $in: request.types },
          },
          {
            'associates.sanctionsSearchTypes': { $in: request.types },
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
          $in: [...request.nationality, 'XX', 'ZZ', null],
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
      const entityTypes: SanctionsEntityType[] =
        request.entityType !== 'PERSON'
          ? ['BANK', 'BUSINESS']
          : [request.entityType]
      if (request.orFilters?.includes('entityType')) {
        orConditions.push({
          entityType: {
            $in: entityTypes,
          },
        })
      } else {
        andConditions.push({
          entityType: {
            $in: entityTypes,
          },
        })
      }
    }

    if (request.yearOfBirth) {
      const matchYearOfBirthCondition = {
        yearOfBirth: {
          $in: [`${request.yearOfBirth}`, null],
        },
      }
      if (request.orFilters?.includes('yearOfBirth')) {
        orConditions.push(matchYearOfBirthCondition)
      } else {
        andConditions.push(matchYearOfBirthCondition)
      }
    }
    if (request.gender) {
      const matchGenderCondition = {
        gender: {
          $in: [request.gender, 'Unknown', null],
        },
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
    return match
  }

  private getProjectionObject(providers: SanctionsDataProviderName[]): {
    rawResponse: 0
    mediaSources?: 0
    sanctionsSources?: 0
    pepSources?: 0
  } {
    const projection: {
      rawResponse: 0
      mediaSources?: 0
      sanctionsSources?: 0
      pepSources?: 0
    } = {
      rawResponse: 0,
    }

    // If Dow Jones is enabled, exclude additional fields
    if (providers.includes(SanctionsDataProviders.DOW_JONES)) {
      projection.mediaSources = 0
      projection.sanctionsSources = 0
      projection.pepSources = 0
    }

    return projection
  }

  async searchWithoutMatchingNames(
    request: SanctionsSearchRequest,
    db: Db
  ): Promise<SanctionsProviderResponse> {
    const match = this.getNonSearchIndexQuery({ request })
    const providers = getDefaultProviders()
    const collectionNames = getCollectionNames(
      request,
      providers,
      this.tenantId
    )
    const results = await Promise.all(
      collectionNames.map((c) =>
        db
          .collection<SanctionsEntity>(c)
          .find(match, {
            projection: this.getProjectionObject(providers),
          })
          .limit(500)
          .toArray()
      )
    )

    return this.searchRepository.saveSearch(
      hydrateHitsWithMatchTypes(results.flat(), request),
      request
    )
  }

  private async transliterateName(name: string): Promise<string> {
    try {
      const transliteratedName = await ask(
        this.tenantId,
        `convert the given name to latin script and only return the name in latin script. The name to convert is ${name}`,
        { tier: ModelTier.ECONOMY }
      )
      return transliteratedName
    } catch (e) {
      console.log('error', e)
      return name
    }
  }

  async searchWithMatchingNames(
    props: SanctionsSearchPropsWithRequest
  ): Promise<SanctionsProviderResponse> {
    const db = this.mongoDb.db()
    const {
      request: requestOriginal,
      limit = 200,
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    } = props
    const request = cloneDeep(requestOriginal)
    if (
      hasFeature('TRANSLITERATION') &&
      !isLatinScript(normalize(request.searchTerm))
    ) {
      request.searchTerm = await this.transliterateName(request.searchTerm)
    }
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
    if (request.types && request.types.length > 0) {
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
      const entityTypes =
        request.entityType !== 'PERSON'
          ? ['BANK', 'BUSINESS']
          : [request.entityType]
      const matchEntityType = entityTypes.map((entityType) => ({
        text: {
          query: entityType,
          path: 'entityType',
        },
      }))
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
        {
          equals: {
            value: null,
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
    const stopwordSet = request.stopwords?.length
      ? new Set(request.stopwords.map((word) => word.toLowerCase()))
      : undefined
    const collectionNames = getCollectionNames(
      request,
      providers,
      this.tenantId
    )
    const nameWithoutSpecialCharacters =
      sanitizeStringWithSpecialCharactersForTokenization(
        normalize(request.searchTerm)
      )
    const nameWithSpaces = replaceRequiredCharactersWithSpace(
      normalize(request.searchTerm),
      true
    )
    const results = await Promise.all(
      collectionNames.flatMap((c) => [
        db
          .collection(c)
          .aggregate<SanctionsEntity>([
            {
              $match: this.getNonSearchIndexQuery({
                request,
                sanctionSourceIds,
                pepSourceIds,
                relSourceIds,
                sanctionsCategory,
                pepCategory,
                relCategory,
                adverseMediaCategory,
              }),
            },
            {
              $limit: providers.includes(SanctionsDataProviders.DOW_JONES)
                ? limit
                : limit + 50,
            },
            {
              $project: this.getProjectionObject(providers),
            },
          ])
          .toArray(),
        db
          .collection(c)
          .aggregate<SanctionsEntity>([
            {
              $search: {
                index: getSearchIndexName(c),
                concurrent: true,
                compound: {
                  must: [
                    {
                      compound: {
                        should: [
                          {
                            text: {
                              query: nameWithSpaces,
                              path: 'normalizedAka',
                              fuzzy: {
                                maxEdits: 2,
                                maxExpansions: 100,
                                prefixLength: 0,
                              },
                            },
                          },
                          ...(nameWithoutSpecialCharacters !== nameWithSpaces
                            ? [
                                {
                                  text: {
                                    query: nameWithoutSpecialCharacters,
                                    path: 'normalizedAka',
                                    fuzzy: {
                                      maxEdits: 2,
                                      maxExpansions: 100,
                                      prefixLength: 0,
                                    },
                                  },
                                },
                              ]
                            : []),
                        ],
                        minimumShouldMatch: 1,
                      },
                    },
                  ],
                  ...(orFilters.length > 0
                    ? { should: orFilters, minimumShouldMatch: 1 }
                    : {}),
                  ...(andFilters?.length
                    ? {
                        filter: andFilters,
                      }
                    : {}),
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
              $match: {
                ...match,
                ...this.applySourceCategoryFilters({
                  sanctionSourceIds,
                  pepSourceIds,
                  relSourceIds,
                  sanctionsCategory,
                  pepCategory,
                  relCategory,
                  adverseMediaCategory,
                }),
              },
            },
            {
              $project: this.getProjectionObject(providers),
            },
          ])
          .toArray(),
      ])
    )
    const fuzzinessSettings = request?.fuzzinessSettings
    const filteredResults = hydrateHitsWithMatchTypes(
      this.filterResults(
        uniqBy(results.flat(), (s) => s.id),
        request,
        fuzzinessSettings,
        stopwordSet
      ),
      request
    )

    return this.searchRepository.saveSearch(filteredResults, requestOriginal)
  }

  private getFuzzinessFunction(
    fuzzinessSettings: FuzzinessSetting | undefined,
    manualSearch: boolean | undefined
  ): (a: string, b: string, options: FuzzinessOptions) => number {
    if (fuzzinessSettings?.similarTermsConsideration || manualSearch) {
      return token_similarity_sort_ratio
    }

    if (fuzzinessSettings?.jarowinklerDistance) {
      return jaro_winkler_distance
    }

    return fuzzy_levenshtein_distance
  }

  public processNameWithStopwords = (name: string, stopwords?: Set<string>) => {
    if (!stopwords) {
      return name
    }

    const normalizedText = name.replace(/\.(?!\s)/g, '. ')

    const words = normalizedText.split(' ')

    const filteredWords = words.filter((word) => {
      const lowerCaseWord = word.toLowerCase()
      if (stopwords.has(lowerCaseWord)) {
        return false
      }

      // Keep Very Short Words (If Not Exact Stopwords)
      // If the word is very short (less than 3 chars) and wasn't an exact stopword,
      // keep it. Fuzzy matching on very short words is unreliable.
      if (lowerCaseWord.length < 3) {
        return true
      }

      // Check if the word is a close misspelling of any stopword.
      const isStopwordByFuzzyMatch = Array.from(stopwords).some((stopword) => {
        // Skip Very Short Stopwords for Fuzzy Matching
        // Do not attempt to fuzzy match against stopwords that are themselves very short (e.g., "co", "l").
        if (stopword.length < 3) {
          return false // Stopword is too short for reliable fuzzy comparison target.
        }

        // Length Similarity Pre-check
        // Only perform fuzzy matching if the word and stopword lengths are reasonably close
        // (absolute difference no more than 2 characters).
        if (Math.abs(lowerCaseWord.length - stopword.length) > 2) {
          return false // Lengths are too different for a likely meaningful fuzzy match.
        }

        // Dynamic Jaro-Winkler Threshold
        // Adjust the similarity threshold based on the length of the stopword.
        // Shorter stopwords might need a slightly different sensitivity.
        let dynamicThreshold = 82.0 // Default threshold for longer stopwords (e.g., "corporation", "limited").
        if (stopword.length <= 4) {
          // For shorter stopwords (length 3 or 4, e.g., "inc", "ltd", "bank").
          dynamicThreshold = 80.0 // Use a slightly different threshold.
        }

        const similarity = jaro_winkler_distance(lowerCaseWord, stopword, {
          omitSpaces: true,
          partialMatch: false,
          partialMatchLength: 0,
          fuzzinessThreshold: dynamicThreshold,
        })

        // If the similarity score exceeds the dynamic threshold, consider it a fuzzy match.
        if (similarity > dynamicThreshold) {
          return true // Word is a stopword by fuzzy match.
        }
        return false // Not a fuzzy match with this particular stopword.
      })

      // If the word was identified as a stopword by fuzzy match, filter it out.
      // Otherwise (not an exact match, not a fuzzy match), keep it.
      return !isStopwordByFuzzyMatch
    })

    // Join the remaining (filtered) words back into a string, separated by spaces.
    const result = filteredWords.join(' ').trim()

    // Return the final processed name.
    return result
  }

  private isAddressFuzzyMatch(
    userAddresses: Address[],
    entityAddresses: SanctionsEntityAddress[]
  ) {
    if (userAddresses.length === 0 || entityAddresses.length === 0) {
      return true
    }
    for (const entityAddress of entityAddresses) {
      for (const userAddress of userAddresses) {
        if (
          userAddress.postcode &&
          entityAddress.postalCode &&
          userAddress.postcode === entityAddress.postalCode
        ) {
          return true
        }
        if (
          userAddress.city &&
          entityAddress.city &&
          userAddress.city === entityAddress.city
        ) {
          return true
        }
        if (
          userAddress.addressLines?.every((line) => !line.trim()) ||
          !entityAddress.addressLine?.trim()
        ) {
          return true
        }
        if (
          userAddress.addressLines?.some((line) => line.trim()) &&
          entityAddress.addressLine?.trim()
        ) {
          const options = {
            abbreviate: true,
          }

          const formattedUserAddress = formatAddress(
            {
              streetAddress: userAddress.addressLines,
              country: entityAddress.country,
            },
            options
          )
          const formattedEntityAddress = formatAddress(
            {
              streetAddress: [entityAddress.addressLine],
              country: entityAddress.country,
            },
            options
          )

          const percentageSimilarity = token_similarity_sort_ratio(
            sanitizeString(formattedUserAddress),
            sanitizeString(formattedEntityAddress),
            {
              omitSpaces: false,
              partialMatch: true,
              partialMatchLength: formattedUserAddress.split(' ').length,
              fuzzinessThreshold: 70,
            }
          )
          if (percentageSimilarity >= 70) {
            return true
          }
        }
      }
    }
    return false
  }

  private filterResults(
    results: SanctionsEntity[],
    request: SanctionsSearchRequest,
    fuzzinessSettings: FuzzinessSetting | undefined,
    stopwordSet: Set<string> | undefined
  ): SanctionsEntity[] {
    const evaluatingFunction = this.getFuzzinessFunction(
      fuzzinessSettings,
      request.manualSearch
    )
    const fuzzinessThreshold = getFuzzinessThreshold(request)
    const keepSpaces = Boolean(!fuzzinessSettings?.sanitizeInputForFuzziness)
    const shouldSanitizeString =
      fuzzinessSettings?.sanitizeInputForFuzziness ||
      fuzzinessSettings?.similarTermsConsideration ||
      request.manualSearch

    const modifiedTerm = this.processNameWithStopwords(
      request.searchTerm,
      stopwordSet
    )
      .toLowerCase()
      .trim()
    const searchTerms = uniq(
      shouldSanitizeString
        ? [
            sanitizeString(modifiedTerm),
            sanitizeString(modifiedTerm, true, true, false),
          ]
        : [
            normalize(modifiedTerm),
            sanitizeStringWithSpecialCharactersForTokenization(
              normalize(modifiedTerm)
            ),
          ]
    )

    const searchTermsTokensLength = searchTerms.map(
      (searchTerm) => searchTerm.split(' ').length
    )
    return results.filter((entity) => {
      if (
        request.addresses?.length &&
        !this.isAddressFuzzyMatch(
          request.addresses ?? [],
          entity.addresses ?? []
        )
      ) {
        return false
      }
      const values = uniq(entity.normalizedAka || []).flatMap((name) => {
        const processedName = this.processNameWithStopwords(name, stopwordSet)
        return shouldSanitizeString
          ? [
              sanitizeString(processedName, true, false, false),
              sanitizeString(processedName, true, false, true),
            ]
          : [
              processedName,
              sanitizeStringWithSpecialCharactersForTokenization(processedName),
            ]
      })
      if (
        request.fuzzinessRange?.upperBound === 100 ||
        request.fuzziness === 1
      ) {
        return true
      } else {
        for (let i = 0; i < searchTerms.length; i++) {
          const searchTerm = searchTerms[i]
          const searchTermTokensLength = searchTermsTokensLength[i]
          for (const name of values) {
            if (name === searchTerm) {
              return true
            }
            const percentageSimilarity = evaluatingFunction(searchTerm, name, {
              omitSpaces: !keepSpaces,
              partialMatch: !!request.partialMatch || !!request.manualSearch,
              partialMatchLength: searchTermTokensLength,
              fuzzinessThreshold,
              enablePhoneticMatching: request.enablePhoneticMatching,
            })
            const fuzzyMatch =
              SanctionsDataFetcher.getFuzzinessEvaluationResult(
                request,
                percentageSimilarity
              )
            if (fuzzyMatch) {
              return true
            }
          }
        }
      }
      return false
    })
  }

  async getSanctionSourceDetailsInternal(request: SanctionsSearchRequest) {
    const screeningProfileService = new ScreeningProfileService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    return getSanctionSourceDetails(request, screeningProfileService)
  }

  private getOpensearchProjectionFields(request: SanctionsSearchRequest) {
    if (request.manualSearch) {
      return SanctionsEntity.attributeTypeMap
        .map((a) => a.name)
        .filter((a) => !OPENSEARCH_NON_PROJECTED_FIELDS.includes(a))
    }
    const projectionFields: string[] = ['id', 'normalizedAka', 'entityType']
    if (request.addresses?.length) {
      projectionFields.push('addresses')
    }
    return projectionFields
  }

  private getOpensearchQueryConditions(
    props: SanctionsSearchPropsWithRequest,
    providers: SanctionsDataProviderName[]
  ) {
    const { request, containAllSources } = props
    const shouldConditions: QueryContainer[] = []
    const mustConditions: QueryContainer[] = []
    const allSourceIds = getAggregatedSourceIds(props)
    const aggregateScreeningProfileData =
      getContext()?.settings?.sanctions?.aggregateScreeningProfileData
    if (
      allSourceIds.length &&
      !containAllSources &&
      !aggregateScreeningProfileData
    ) {
      mustConditions.push({
        terms: {
          aggregatedSourceIds: allSourceIds,
        },
      })
    }
    if (
      request?.types?.length &&
      (request.manualSearch || !containAllSources) &&
      !aggregateScreeningProfileData
    ) {
      const typesCondition = [
        { terms: { sanctionSearchTypes: request.types } },
        { terms: { 'associates.sanctionsSearchTypes': request.types } },
      ]
      mustConditions.push({
        bool: {
          should: typesCondition,
          minimum_should_match: 1,
        },
      })
    }
    if (request.yearOfBirth) {
      const yearOfBirthCondition = [
        { term: { yearOfBirth: request.yearOfBirth } },
        { bool: { must_not: { exists: { field: 'yearOfBirth' } } } },
      ]
      if (request.orFilters?.includes('yearOfBirth')) {
        shouldConditions.push(...yearOfBirthCondition)
      } else {
        mustConditions.push({
          bool: {
            should: yearOfBirthCondition,
            minimum_should_match: 1,
          },
        })
      }
    }

    if (request.gender) {
      const genderCondition = [
        { terms: { gender: [request.gender, 'Unknown'] } },
        { bool: { must_not: { exists: { field: 'gender' } } } },
      ]
      if (request.orFilters?.includes('gender')) {
        shouldConditions.push(...genderCondition)
      } else {
        mustConditions.push({
          bool: {
            should: genderCondition,
            minimum_should_match: 1,
          },
        })
      }
    }
    if (request.nationality) {
      const nationalityCondition = [
        { terms: { nationality: [...request.nationality, 'XX', 'ZZ'] } },
        { bool: { must_not: { exists: { field: 'nationality' } } } },
      ]
      if (request.orFilters?.includes('nationality')) {
        shouldConditions.push(...nationalityCondition)
      } else {
        mustConditions.push({
          bool: {
            should: nationalityCondition,
            minimum_should_match: 1,
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
                term: {
                  'documents.formattedId': docId,
                },
              },
              {
                term: {
                  'documents.id': docId,
                },
              },
            ])
          : [
              {
                term: {
                  'documents.formattedId': '__no_match__',
                },
              },
            ]
      if (request.orFilters?.includes('documentId')) {
        shouldConditions.push(...documentIdMatch)
        mustConditions.push({
          bool: {
            must_not: {
              exists: {
                field: 'documents.id',
              },
            },
          },
        })
      } else {
        mustConditions.push({
          bool: {
            should: documentIdMatch,
            must_not: [
              {
                exists: {
                  field: 'documents.id',
                },
              },
            ],
            minimum_should_match: 1,
          },
        })
      }
    }
    if (
      !(request.allowDocumentMatches || request.manualSearch) &&
      request.documentId?.length
    ) {
      mustConditions.push({
        bool: {
          must_not: request.documentId.flatMap((docId) => [
            {
              term: {
                'documents.id': docId,
              },
            },
            {
              term: {
                'documents.formattedId': docId,
              },
            },
          ]),
        },
      })
    }

    if (request.isOngoingScreening) {
      const isOngoingScreeningCondition = [{ terms: { provider: providers } }]
      mustConditions.push({
        bool: {
          should: isOngoingScreeningCondition,
          minimum_should_match: 1,
        },
      })
    }

    if (request.PEPRank) {
      const PEPRankCondition = [
        { term: { PEPRank: request.PEPRank } },
        { bool: { must_not: { exists: { field: 'PEPRank' } } } },
      ]
      mustConditions.push({
        bool: {
          should: PEPRankCondition,
          minimum_should_match: 1,
        },
      })
    }

    if (
      request.entityType &&
      request.entityType !== 'EXTERNAL_USER' &&
      aggregateScreeningProfileData
    ) {
      const entityTypes: SanctionsEntityType[] =
        request.entityType !== 'PERSON'
          ? ['BANK', 'BUSINESS']
          : [request.entityType]
      if (request.orFilters?.includes('entityType')) {
        shouldConditions.push({
          terms: {
            entityType: entityTypes,
          },
        })
      } else {
        mustConditions.push({
          terms: {
            entityType: entityTypes,
          },
        })
      }
    }
    return {
      shouldConditions,
      mustConditions,
    }
  }

  private async getOpensearchQueryResults(
    props: SanctionsSearchPropsWithRequest
  ) {
    const { request } = props
    const client = this.opensearchClient ?? (await getOpensearchClient())
    const searchTerm = normalize(request.searchTerm)
    const providers = getDefaultProviders()
    const { shouldConditions, mustConditions } =
      this.getOpensearchQueryConditions(props, providers)
    const collectionNames = getCollectionNames(
      request,
      providers,
      this.tenantId,
      {
        screeningProfileContainsAllSources: props.containAllSources,
        screeningProfileId: request.screeningProfileId,
      }
    )
    const query = this.getOpensearchQuery({
      searchTerm,
      shouldConditions,
      mustConditions,
      request,
    })
    const time = Date.now()
    const results = await Promise.allSettled(
      collectionNames.flatMap((c) => [
        client.search({
          index: c,
          _source: this.getOpensearchProjectionFields(request),
          body: query,
        }),
      ])
    )
    logger.info(`Query time: ${Date.now() - time}`)
    if (results.some((r) => r.status === 'rejected')) {
      logger.error(
        `Error in opensearch search: ${JSON.stringify(
          results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r) => r.reason)
        )}`
      )
    }
    const hits = results
      .filter(
        (r): r is PromiseFulfilledResult<Search_Response> =>
          r.status === 'fulfilled'
      )
      .map((r) => r.value)
      .flatMap((r) =>
        r.body.hits.hits.map((h) => h._source)
      ) as SanctionsEntity[]
    return hits
  }
  async searchWithOpensearch(
    props: SanctionsSearchPropsWithRequest
  ): Promise<SanctionsProviderResponse> {
    const { request } = props
    const stopwordSet = request.stopwords?.length
      ? new Set(request.stopwords.map((word) => word.toLowerCase()))
      : undefined
    const hits = await this.getOpensearchQueryResults(props)
    const fuzzinessSettings = request?.fuzzinessSettings
    const filterResultsTime = Date.now()
    const filteredResults = this.filterResults(
      uniqBy(hits, (s) => s.id),
      request,
      fuzzinessSettings,
      stopwordSet
    )
    logger.info(`filterResultsTime: ${Date.now() - filterResultsTime}`)
    const data = await this.searchRepository.saveSearch(
      filteredResults,
      request
    )
    return data
  }

  private getOpensearchQuery({
    searchTerm,
    shouldConditions,
    mustConditions,
    request,
  }): Search_RequestBody {
    const normalizedSearchTerm = normalize(searchTerm)
    const sanitizeStringWithSpecialCharactersForTokenizationSearchTerm =
      sanitizeStringWithSpecialCharactersForTokenization(normalizedSearchTerm)
    const addPlainFuzzyQuery = searchTerm.split(' ').includes('the')
    const fields: string[] = ['normalizedAka.fuzzy_with_stopwords_removal']
    const terms = uniq([
      normalizedSearchTerm,
      sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
    ])
    if (addPlainFuzzyQuery) {
      fields.push('normalizedAka.fuzzy')
    }
    const fuzzyQueryTerms = terms.map((term) => {
      const tokens = uniq(term.split(' '))
      return tokens.join(' ')
    })
    const hasMustConditions =
      mustConditions.length > 0 || shouldConditions.length > 0
    return {
      size: 250,
      track_total_hits: false,
      min_score: 0.1,
      query: {
        bool: {
          ...(hasMustConditions
            ? {
                must: [
                  ...(shouldConditions.length
                    ? [
                        {
                          bool: {
                            should: shouldConditions,
                            minimum_should_match: 1,
                          },
                        },
                      ]
                    : []),
                  ...mustConditions,
                ],
              }
            : {}),
          should: [
            {
              terms: {
                'normalizedAka.exact': terms,
                boost: 5,
              },
            },
            ...(fields.length > 1
              ? fuzzyQueryTerms.map(
                  (term): QueryContainer => ({
                    multi_match: {
                      query: term,
                      fields: fields,
                      type: 'best_fields',
                      tie_breaker: 0.25,
                      fuzziness: 2,
                      max_expansions: 100,
                      prefix_length: 1,
                    },
                  })
                )
              : fuzzyQueryTerms.map(
                  (term): QueryContainer => ({
                    match: {
                      'normalizedAka.fuzzy_with_stopwords_removal': {
                        query: term,
                        boost: 1,
                        fuzziness: 2,
                        max_expansions: 100,
                        prefix_length: 1,
                      },
                    },
                  })
                )),
          ],
          minimum_should_match: 1,
        },
      },
      _source: this.getOpensearchProjectionFields(request),
    }
  }

  async search(
    request: SanctionsSearchRequest,
    isMigration?: boolean // TODO: remove this once after migration is done
  ): Promise<SanctionsProviderResponse> {
    let result: SanctionsProviderResponse
    const {
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
      containAllSources,
    } = await this.getSanctionSourceDetailsInternal(request)
    if (hasFeature('OPEN_SEARCH')) {
      return await this.searchWithOpensearch({
        request,
        sanctionSourceIds,
        pepSourceIds,
        relSourceIds,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory,
        containAllSources,
      })
    }
    if (
      !request.manualSearch &&
      (request.fuzzinessRange?.upperBound === 100 ||
        (request.fuzziness ?? 0) * 100 === 100)
    ) {
      result = await this.searchWithoutMatchingNames(request, this.mongoDb.db())
    } else {
      result = await this.searchWithMatchingNames({
        request,
        limit: isMigration || request.manualSearch ? 500 : 200,
        sanctionSourceIds,
        pepSourceIds,
        relSourceIds,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory,
      })
    }
    const data = result.data?.map(
      (entity: SanctionsEntity): SanctionsEntity => ({
        ...entity,
        matchTypeDetails: [deriveMatchingDetails(request, entity)],
      })
    )
    return {
      ...result,
      data: await sanitizeEntities({
        data,
        sanctionSourceIds,
        pepSourceIds,
        relSourceIds,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory,
      }),
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
}
