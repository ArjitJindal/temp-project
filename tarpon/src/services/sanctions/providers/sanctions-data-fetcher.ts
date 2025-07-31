import { cloneDeep, uniq, uniqBy } from 'lodash'
import {
  isLatinScript,
  normalize,
  adverseMediaCategoryMap,
  replaceRequiredCharactersWithSpace,
  sanitizeString,
  sanitizeStringWithSpecialCharactersForTokenization,
} from '@flagright/lib/utils'
import { Db, MongoClient } from 'mongodb'
import { Search_Response } from '@opensearch-project/opensearch/api'
import { CommonOptions, format } from '@fragaria/address-formatter'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { QueryContainer } from '@opensearch-project/opensearch/api/_types/_common.query_dsl'
import { getDefaultProviders, getSanctionsCollectionName } from '../utils'
import {
  SanctionsDataProviders,
  SanctionsSearchProps,
  SanctionsSearchPropsWithRequest,
  SanctionsSearchPropsWithData,
} from '../types'
import {
  getNameMatches,
  getSecondaryMatches,
  sanitizeAcurisEntities,
  sanitizeOpenSanctionsEntities,
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
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
import { traceable } from '@/core/xray'
import { SanctionsMatchTypeDetails } from '@/@types/openapi-internal/SanctionsMatchTypeDetails'
import { getNonDemoTenantId } from '@/utils/tenant'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { ScreeningProfileService } from '@/services/screening-profile'
import { SanctionsSourceRelevance } from '@/@types/openapi-internal/SanctionsSourceRelevance'
import { PEPSourceRelevance } from '@/@types/openapi-internal/PEPSourceRelevance'
import { AdverseMediaSourceRelevance } from '@/@types/openapi-internal/AdverseMediaSourceRelevance'
import { RELSourceRelevance } from '@/@types/openapi-internal/RELSourceRelevance'
import { hasFeature } from '@/core/utils/context'
import {
  getOpensearchClient,
  isOpensearchAvailableInRegion,
} from '@/utils/opensearch-utils'
import { logger } from '@/core/logger'
import { Address } from '@/@types/openapi-public/Address'
import { SanctionsEntityAddress } from '@/@types/openapi-internal/SanctionsEntityAddress'
import { ask } from '@/utils/llms'
import { ModelTier } from '@/utils/llms/base-service'
import { generateHashFromString } from '@/utils/object'

const OPENSEARCH_NON_PROJECTED_FIELDS = ['rawResponse', 'aggregatedSourceIds']
@traceable
export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository
  private readonly tenantId: string
  private readonly mongoDb: MongoClient
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(
    provider: SanctionsDataProviderName,
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.providerName = provider
    this.searchRepository = new SanctionsProviderSearchRepository()
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
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
        if (sanitizeString(request.searchTerm) == sanitizeString(hit.name)) {
          matchTypes.push('name_exact')
        } else if (
          hit.aka?.some(
            (aka) => sanitizeString(request.searchTerm) == sanitizeString(aka)
          )
        ) {
          matchTypes.push('aka_exact')
        } else {
          matchTypes.push('aka_fuzzy')
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

  async searchWithoutMatchingNames(
    request: SanctionsSearchRequest,
    db: Db
  ): Promise<SanctionsProviderResponse> {
    const match = this.getNonSearchIndexQuery({ request })
    const providers = getDefaultProviders()
    const collectionNames = this.getCollectionNames(request, providers)
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
    const collectionNames = this.getCollectionNames(request, providers)
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
              $project: {
                rawResponse: 0,
              },
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
              $project: {
                rawResponse: 0,
              },
            },
          ])
          .toArray(),
      ])
    )
    const fuzzinessSettings = request?.fuzzinessSettings
    const filteredResults = this.hydrateHitsWithMatchTypes(
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

        const similarity = jaro_winkler_distance(lowerCaseWord, stopword, {
          omitSpaces: true,
          partialMatch: false,
          partialMatchLength: 0,
        })

        // Dynamic Jaro-Winkler Threshold
        // Adjust the similarity threshold based on the length of the stopword.
        // Shorter stopwords might need a slightly different sensitivity.
        let dynamicThreshold = 82.0 // Default threshold for longer stopwords (e.g., "corporation", "limited").
        if (stopword.length <= 4) {
          // For shorter stopwords (length 3 or 4, e.g., "inc", "ltd", "bank").
          dynamicThreshold = 80.0 // Use a slightly different threshold.
        }

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
          const options: CommonOptions & { output: 'array' } = {
            abbreviate: true,
            output: 'array',
          }

          const formattedUserAddress = format(
            {
              street: userAddress.addressLines.join(', '),
              country: entityAddress.country,
            },
            options
          ).join(', ')
          const formattedEntityAddress = format(
            {
              street: entityAddress.addressLine,
              country: entityAddress.country,
            },
            options
          ).join(', ')

          const percentageSimilarity = token_similarity_sort_ratio(
            sanitizeString(formattedUserAddress),
            sanitizeString(formattedEntityAddress),
            {
              omitSpaces: false,
              partialMatch: true,
              partialMatchLength: formattedUserAddress.split(' ').length,
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
            const evaluatingFunction = this.getFuzzinessFunction(
              fuzzinessSettings,
              request.manualSearch
            )
            const percentageSimilarity = evaluatingFunction(searchTerm, name, {
              omitSpaces: !keepSpaces,
              partialMatch: !!request.partialMatch || !!request.manualSearch,
              partialMatchLength: searchTermTokensLength,
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

  async getSanctionSourceDetails(screeningProfileId: string) {
    const screeningProfileService = new ScreeningProfileService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const screeningProfile =
      await screeningProfileService.getExistingScreeningProfile(
        screeningProfileId
      )
    const sanctionSourceIds = screeningProfile.sanctions?.sourceIds
    const pepSourceIds = screeningProfile.pep?.sourceIds
    const relSourceIds = screeningProfile.rel?.sourceIds
    const sanctionsCategory = screeningProfile.sanctions?.relevance
    const pepCategory = screeningProfile.pep?.relevance
    const relCategory = screeningProfile.rel?.relevance
    const adverseMediaCategory = screeningProfile.adverseMedia?.relevance
    return {
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
      containAllSources: screeningProfile.containAllSources,
    }
  }

  private getAggregatedSourceIds(props: SanctionsSearchProps) {
    const {
      sanctionSourceIds = [],
      pepSourceIds = [],
      relSourceIds = [],
      sanctionsCategory = [],
      pepCategory = [],
      relCategory = [],
      adverseMediaCategory = [],
    } = props
    const allSourceIds: string[] = []
    if (sanctionSourceIds?.length) {
      sanctionSourceIds.forEach((sourceId) => {
        sanctionsCategory.forEach((category) => {
          allSourceIds.push(`${sourceId}-${category}`)
        })
      })
    }
    if (pepSourceIds?.length) {
      if (pepCategory.includes('PEP')) {
        pepSourceIds.forEach((sourceId) => {
          allSourceIds.push(`${sourceId}-PEP`)
        })
      }
      if (pepCategory.includes('POI')) {
        allSourceIds.push('POI')
      }
    }
    if (relSourceIds?.length) {
      relSourceIds.forEach((sourceId) => {
        relCategory.forEach((category) => {
          allSourceIds.push(`${sourceId}-${category}`)
        })
      })
    }
    if (adverseMediaCategory?.length) {
      adverseMediaCategory.forEach((category) => {
        allSourceIds.push(adverseMediaCategoryMap[category])
      })
    }
    return uniq(allSourceIds)
  }

  private getOpensearchQueryConditions(
    props: SanctionsSearchPropsWithRequest,
    providers: SanctionsDataProviderName[]
  ) {
    const { request, containAllSources } = props
    const shouldConditions: QueryContainer[] = []
    const mustConditions: QueryContainer[] = []
    const allSourceIds = this.getAggregatedSourceIds(props)
    if (allSourceIds.length && !containAllSources) {
      mustConditions.push({
        terms: {
          aggregatedSourceIds: allSourceIds,
        },
      })
    }
    if (request?.types?.length) {
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
    return {
      shouldConditions,
      mustConditions,
    }
  }

  private async getOpensearchQueryResults(
    props: SanctionsSearchPropsWithRequest
  ) {
    const { request } = props
    const client = await getOpensearchClient()
    const searchTerm = normalize(request.searchTerm)
    const providers = getDefaultProviders()
    const { shouldConditions, mustConditions } =
      this.getOpensearchQueryConditions(props, providers)
    const collectionNames = this.getCollectionNames(request, providers)
    const queryWithoutStopwords = this.getOpensearchQuery({
      searchTerm,
      shouldConditions,
      mustConditions,
      onlyFuzzyQuery: false,
    })

    const queryWithStopwords = searchTerm.split(' ').includes('the')
      ? this.getOpensearchQuery({
          searchTerm,
          shouldConditions,
          mustConditions,
          onlyFuzzyQuery: true,
        })
      : undefined
    const results = await Promise.allSettled(
      collectionNames.flatMap((c) => [
        client.search({
          index: c,
          _source: SanctionsEntity.attributeTypeMap
            .map((a) => a.name)
            .filter((a) => !OPENSEARCH_NON_PROJECTED_FIELDS.includes(a)),
          body: queryWithoutStopwords,
        }),
        ...(queryWithStopwords
          ? [
              client.search({
                index: c,
                _source: SanctionsEntity.attributeTypeMap
                  .map((a) => a.name)
                  .filter((a) => !OPENSEARCH_NON_PROJECTED_FIELDS.includes(a)),
                body: queryWithStopwords,
              }),
            ]
          : []),
      ])
    )
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
    const filteredResults = this.hydrateHitsWithMatchTypes(
      this.filterResults(
        uniqBy(hits, (s) => s.id),
        request,
        fuzzinessSettings,
        stopwordSet
      ),
      request
    )

    return this.searchRepository.saveSearch(filteredResults, request)
  }

  private getOpensearchQuery({
    searchTerm,
    shouldConditions,
    mustConditions,
    onlyFuzzyQuery,
  }) {
    const normalizedSearchTerm = normalize(searchTerm)
    const sanitizeStringWithSpecialCharactersForTokenizationSearchTerm =
      sanitizeStringWithSpecialCharactersForTokenization(normalizedSearchTerm)
    return {
      size: 1000,
      query: {
        bool: {
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
            {
              bool: {
                should: [
                  ...(onlyFuzzyQuery
                    ? [
                        {
                          match: {
                            'normalizedAka.fuzzy': {
                              query:
                                sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
                              fuzziness: 2,
                              max_expansions: 100,
                              prefix_length: 0,
                              boost: 1,
                            },
                          },
                        },
                        ...(sanitizeStringWithSpecialCharactersForTokenizationSearchTerm !==
                        normalizedSearchTerm
                          ? [
                              {
                                match: {
                                  'normalizedAka.fuzzy': {
                                    query:
                                      sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
                                    fuzziness: 2,
                                    max_expansions: 100,
                                    prefix_length: 0,
                                    boost: 1,
                                  },
                                },
                              },
                            ]
                          : []),
                      ]
                    : [
                        {
                          match: {
                            'normalizedAka.exact': {
                              query:
                                sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
                              boost: 5,
                            },
                          },
                        },
                        {
                          match: {
                            'normalizedAka.fuzzy_with_stopwords_removal': {
                              query:
                                sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
                              fuzziness: 2,
                              max_expansions: 100,
                              prefix_length: 0,
                              boost: 1,
                            },
                          },
                        },
                      ]),
                  ...(sanitizeStringWithSpecialCharactersForTokenizationSearchTerm !==
                  normalizedSearchTerm
                    ? [
                        {
                          match: {
                            'normalizedAka.fuzzy': {
                              query:
                                sanitizeStringWithSpecialCharactersForTokenizationSearchTerm,
                              fuzziness: 2,
                              max_expansions: 100,
                              prefix_length: 0,
                              boost: 1,
                            },
                          },
                        },
                      ]
                    : []),
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    }
  }

  private getEntityTypes(
    request: SanctionsSearchRequest
  ): SanctionsEntityType[] {
    if (request.entityType === 'EXTERNAL_USER' || request.manualSearch) {
      return ['PERSON', 'BUSINESS', 'BANK']
    }
    switch (request.entityType) {
      case 'PERSON':
        return ['PERSON']
      case 'BUSINESS':
      case 'BANK':
        return ['BUSINESS', 'BANK']
      default:
        return ['PERSON', 'BUSINESS', 'BANK']
    }
  }

  private getCollectionNames(
    request: SanctionsSearchRequest,
    providers: SanctionsDataProviderName[]
  ) {
    const nonDemoTenantId = getNonDemoTenantId(this.tenantId)
    const entityTypes: SanctionsEntityType[] = this.getEntityTypes(request)
    return uniq(
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
  }

  async search(
    request: SanctionsSearchRequest,
    isMigration?: boolean // TODO: remove this once after migration is done
  ): Promise<SanctionsProviderResponse> {
    let result: SanctionsProviderResponse
    let sanctionSourceIds: string[] | undefined = undefined
    let pepSourceIds: string[] | undefined = undefined
    let relSourceIds: string[] | undefined = undefined
    let sanctionsCategory: SanctionsSourceRelevance[] | undefined
    let pepCategory: PEPSourceRelevance[] | undefined
    let relCategory: RELSourceRelevance[] | undefined
    let adverseMediaCategory: AdverseMediaSourceRelevance[] | undefined
    let containAllSources: boolean | undefined = undefined
    if (request.screeningProfileId) {
      const details = await this.getSanctionSourceDetails(
        request.screeningProfileId
      )
      sanctionSourceIds = details.sanctionSourceIds
      pepSourceIds = details.pepSourceIds
      relSourceIds = details.relSourceIds
      sanctionsCategory = details.sanctionsCategory
      pepCategory = details.pepCategory
      relCategory = details.relCategory
      adverseMediaCategory = details.adverseMediaCategory
      containAllSources = details.containAllSources
      if (request.types) {
        if (!request.types.includes('PEP')) {
          pepSourceIds = []
          pepCategory = []
        }
        if (!request.types.includes('SANCTIONS')) {
          sanctionSourceIds = []
          sanctionsCategory = []
        }
        if (!request.types.includes('REGULATORY_ENFORCEMENT_LIST')) {
          relSourceIds = []
          relCategory = []
        }
        if (!request.types.includes('ADVERSE_MEDIA')) {
          adverseMediaCategory = []
        }
      }
    }
    if (hasFeature('OPEN_SEARCH') && isOpensearchAvailableInRegion()) {
      result = await this.searchWithOpensearch({
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
        data: await this.sanitizeEntities({
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
        matchTypeDetails: [
          SanctionsDataFetcher.deriveMatchingDetails(request, entity),
        ],
      })
    )
    return {
      ...result,
      data: await this.sanitizeEntities({
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

  private async sanitizeEntities(props: SanctionsSearchPropsWithData) {
    const {
      data,
      sanctionSourceIds,
      pepSourceIds,
      relSourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    } = props
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
      ...sanitizeAcurisEntities({
        data: acurisEntities,
        sanctionSourceIds,
        pepSourceIds,
        relSourceIds,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory,
      }),
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
