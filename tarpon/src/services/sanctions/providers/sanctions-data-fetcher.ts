import { cloneDeep, uniq, uniqBy } from 'lodash'
import {
  isLatinScript,
  normalize,
  replaceRequiredCharactersWithSpace,
  sanitizeString,
} from '@flagright/lib/utils'
import { Db, MongoClient } from 'mongodb'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import { CommonOptions, format } from '@fragaria/address-formatter'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getDefaultProviders, getSanctionsCollectionName } from '../utils'
import { SanctionsDataProviders } from '../types'
import { MongoSanctionSourcesRepository } from '../repositories/sanction-source-repository'
import {
  getNameMatches,
  getSecondaryMatches,
  sanitizeAcurisEntities,
  sanitizeOpenSanctionsEntities,
  getFuzzinessEvaluationResult,
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
import { Address } from '@/@types/openapi-public/Address'
import { SanctionsEntityAddress } from '@/@types/openapi-internal/SanctionsEntityAddress'
import { hasFeature } from '@/core/utils/context'
import { ask } from '@/utils/llms'
import { ModelTier } from '@/utils/llms/base-service'

@traceable
export abstract class SanctionsDataFetcher implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository
  private readonly tenantId: string
  private readonly mongoDb: MongoClient
  private readonly dynamoDb: DynamoDBClient

  constructor(
    provider: SanctionsDataProviderName,
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBClient }
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

  private applySourceCategoryFilters(
    sanctionProviderNames?: string[],
    pepProviderNames?: string[],
    relProviderNames?: string[],
    sanctionsCategory?: SanctionsSourceRelevance[],
    pepCategory?: PEPSourceRelevance[],
    relCategory?: RELSourceRelevance[],
    adverseMediaCategory?: AdverseMediaSourceRelevance[]
  ): any {
    const conditions: any[] = []

    if (sanctionsCategory && sanctionProviderNames) {
      conditions.push({
        $and: [
          {
            'sanctionsSources.sourceName': {
              $in: sanctionProviderNames.map((name) =>
                humanizeAuto(name).toLowerCase()
              ),
            },
            'sanctionsSources.category': {
              $in: [...sanctionsCategory, null],
            },
          },
        ],
      })
    }

    if (pepCategory && pepProviderNames) {
      const orConditions: Array<{
        'pepSources.sourceName'?: { $in: string[] }
        types?: string
      }> = [
        {
          'pepSources.sourceName': {
            $in: [...pepProviderNames, ''].map((name) =>
              humanizeAuto(name).toLowerCase()
            ),
          },
        },
      ]

      // Add PEP by association condition if needed
      if (
        pepProviderNames.some((name) =>
          name.toLowerCase().includes('pep by association')
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

    if (relCategory && relProviderNames) {
      conditions.push({
        $and: [
          {
            'otherSources.type': 'REGULATORY_ENFORCEMENT_LIST',
            'otherSources.value.category': {
              $in: relCategory,
            },
          },
          {
            'otherSources.value.sourceName': {
              $in: [...relProviderNames, ''].map((name) =>
                humanizeAuto(name).toLowerCase()
              ),
            },
          },
        ],
      })
    }

    if (adverseMediaCategory) {
      conditions.push({
        'mediaSources.category': {
          $in: adverseMediaCategory.map((cat) =>
            humanizeAuto(cat).toLowerCase()
          ),
        },
      })
    }

    return conditions.length > 0 ? { $or: conditions } : {}
  }

  private getNonSearchIndexQuery(
    request: SanctionsSearchRequest,
    sanctionProviderNames?: string[],
    pepProviderNames?: string[],
    relProviderNames?: string[],
    sanctionsCategory?: SanctionsSourceRelevance[],
    pepCategory?: PEPSourceRelevance[],
    relCategory?: RELSourceRelevance[],
    adverseMediaCategory?: AdverseMediaSourceRelevance[]
  ): {
    $and?: any[] | undefined
    $or?: any[] | undefined
  } {
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

    const sourceCategoryFilters = this.applySourceCategoryFilters(
      sanctionProviderNames,
      pepProviderNames,
      relProviderNames,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory
    )
    if (Object.keys(sourceCategoryFilters).length > 0) {
      orConditions.push(sourceCategoryFilters)
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
    const match = this.getNonSearchIndexQuery(request)
    const providers = getDefaultProviders()
    const nonDemoTenantId = getNonDemoTenantId(this.tenantId)
    const entityTypes: SanctionsEntityType[] =
      request.entityType === 'EXTERNAL_USER'
        ? ['PERSON', 'BUSINESS', 'BANK']
        : request.entityType !== 'PERSON'
        ? ['BUSINESS', 'BANK']
        : ['PERSON']
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
    requestOriginal: SanctionsSearchRequest,
    db: Db,
    limit: number = 200,
    sanctionProviderNames?: string[],
    pepProviderNames?: string[],
    relProviderNames?: string[],
    sanctionsCategory?: SanctionsSourceRelevance[],
    pepCategory?: PEPSourceRelevance[],
    relCategory?: RELSourceRelevance[],
    adverseMediaCategory?: AdverseMediaSourceRelevance[]
  ): Promise<SanctionsProviderResponse> {
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
    const nonDemoTenantId = getNonDemoTenantId(this.tenantId)
    const entityTypes: SanctionsEntityType[] =
      request.entityType === 'EXTERNAL_USER' || request.manualSearch
        ? ['PERSON', 'BUSINESS', 'BANK']
        : request.entityType !== 'PERSON'
        ? ['BUSINESS', 'BANK']
        : ['PERSON']
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
      collectionNames.flatMap((c) => [
        db
          .collection(c)
          .aggregate<SanctionsEntity>([
            {
              $match: this.getNonSearchIndexQuery(
                request,
                sanctionProviderNames,
                pepProviderNames,
                relProviderNames,
                sanctionsCategory,
                pepCategory,
                relCategory,
                adverseMediaCategory
              ),
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
                  must: [
                    {
                      text: {
                        query: replaceRequiredCharactersWithSpace(
                          normalize(request.searchTerm),
                          true
                        ),
                        path: 'normalizedAka',
                        fuzzy: {
                          maxEdits: 2,
                          maxExpansions: 100,
                          prefixLength: 0,
                        },
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
                ...this.applySourceCategoryFilters(
                  sanctionProviderNames,
                  pepProviderNames,
                  relProviderNames,
                  sanctionsCategory,
                  pepCategory,
                  relCategory,
                  adverseMediaCategory
                ),
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
    const searchTerm = shouldSanitizeString
      ? sanitizeString(modifiedTerm)
      : normalize(modifiedTerm)

    const searchTermTokensLength = searchTerm.split(' ').length
    return results.filter((entity) => {
      if (
        !this.isAddressFuzzyMatch(
          request.addresses ?? [],
          entity.addresses ?? []
        )
      ) {
        return false
      }
      const values = uniq(entity.normalizedAka || []).map((name) =>
        this.processNameWithStopwords(name, stopwordSet)
      )
      if (
        request.fuzzinessRange?.upperBound === 100 ||
        request.fuzziness === 1
      ) {
        return true
      } else {
        for (let value of values) {
          value = shouldSanitizeString
            ? sanitizeString(value, true, false)
            : value
          if (value === searchTerm) {
            return true
          }
          const evaluatingFunction = this.getFuzzinessFunction(
            fuzzinessSettings,
            request.manualSearch
          )
          const percentageSimilarity = evaluatingFunction(searchTerm, value, {
            omitSpaces: !keepSpaces,
            partialMatch: !!request.partialMatch || !!request.manualSearch,
            partialMatchLength: searchTermTokensLength,
          })
          const fuzzyMatch = getFuzzinessEvaluationResult(
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
    const sourceIds = [
      ...(sanctionSourceIds ?? []),
      ...(pepSourceIds ?? []),
      ...(relSourceIds ?? []),
    ]
    return {
      sourceIds,
      sanctionsCategory,
      pepCategory,
      relCategory,
      adverseMediaCategory,
    }
  }

  async search(
    request: SanctionsSearchRequest,
    isMigration?: boolean // TODO: remove this once after migration is done
  ): Promise<SanctionsProviderResponse> {
    let result: SanctionsProviderResponse
    const sanctionSourceNames: string[] = []
    const pepSourceNames: string[] = []
    const relSourceNames: string[] = []
    let sourceIds: string[] = []
    let sanctionsCategory: SanctionsSourceRelevance[] | undefined
    let pepCategory: PEPSourceRelevance[] | undefined
    let relCategory: RELSourceRelevance[] | undefined
    let adverseMediaCategory: AdverseMediaSourceRelevance[] | undefined
    if (request.screeningProfileId) {
      const details = await this.getSanctionSourceDetails(
        request.screeningProfileId
      )
      sourceIds = details.sourceIds
      sanctionsCategory = details.sanctionsCategory
      pepCategory = details.pepCategory
      relCategory = details.relCategory
      adverseMediaCategory = details.adverseMediaCategory

      // Only fetch sources if we have sourceIds
      if (sourceIds?.length) {
        const repo = new MongoSanctionSourcesRepository(this.mongoDb)
        const sources = await repo.getSanctionsSources(
          undefined,
          sourceIds,
          undefined,
          undefined,
          { sourceName: 1, sourceType: 1 }
        )
        for (const source of sources) {
          if (!source.sourceName) {
            continue
          }

          if (source.sourceType === 'SANCTIONS') {
            sanctionSourceNames.push(source.sourceName)
          } else if (source.sourceType === 'PEP') {
            pepSourceNames.push(source.sourceName)
          } else if (source.sourceType === 'REGULATORY_ENFORCEMENT_LIST') {
            relSourceNames.push(source.sourceName)
          }
        }
      }
      if (!request.manualSearch && request.types) {
        const types = new Set(request.types)

        if (!types.has('PEP')) {
          pepSourceNames.length = 0
          pepCategory = []
        }
        if (!types.has('SANCTIONS')) {
          sanctionSourceNames.length = 0
          sanctionsCategory = []
        }
        if (!types.has('REGULATORY_ENFORCEMENT_LIST')) {
          relCategory = []
        }
        if (!types.has('ADVERSE_MEDIA')) {
          adverseMediaCategory = []
        }
      }
    }
    const db = this.mongoDb.db()
    if (
      !request.manualSearch &&
      (request.fuzzinessRange?.upperBound === 100 ||
        (request.fuzziness ?? 0) * 100 === 100)
    ) {
      result = await this.searchWithoutMatchingNames(request, db)
    } else {
      result = await this.searchWithMatchingNames(
        request,
        db,
        isMigration || request.manualSearch ? 500 : 200,
        sanctionSourceNames,
        pepSourceNames,
        relSourceNames,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory
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
      data: await this.sanitizeEntities(
        data,
        sanctionSourceNames,
        pepSourceNames,
        relSourceNames,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory
      ),
    }
  }

  private async sanitizeEntities(
    data: SanctionsEntity[] | undefined,
    sanctionSourceNames?: string[],
    pepSourceNames?: string[],
    relSourceNames?: string[],
    sanctionsCategory?: SanctionsSourceRelevance[],
    pepCategory?: PEPSourceRelevance[],
    relCategory?: RELSourceRelevance[],
    adverseMediaCategory?: AdverseMediaSourceRelevance[]
  ) {
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
      ...sanitizeAcurisEntities(
        acurisEntities,
        sanctionSourceNames,
        pepSourceNames,
        relSourceNames,
        sanctionsCategory,
        pepCategory,
        relCategory,
        adverseMediaCategory
      ),
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
