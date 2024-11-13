import path from 'path'
import fs from 'fs'
import { uniq } from 'lodash'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { logger } from '@/core/logger'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { getS3Client, readFileFromS3 } from '@/utils/s3'
import { envIs } from '@/utils/env'
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
const documentIdToIds = new Map<string, string[]>()
const nameToIds = new Map<string, string[]>()
const sanctionEntities = new Map<string, SanctionsEntity>()
const namesByLength = new Map<number, string[]>()
let userMatches: Record<string, string[]> = {}

let fetchPromise: Promise<any> | undefined
let dataLoaded = false

export async function getUserMatches() {
  // Read the file contents
  const s3Client = getS3Client()
  let fileContent
  if (envIs('test')) {
    const filePath = path.join(__dirname, './__tests__/matched_user_ids.csv')
    fileContent = fs.readFileSync(filePath, 'utf-8')
  } else {
    fileContent = await readFileFromS3(
      s3Client,
      `flagright-datalake-prod-asia-1-bucket`,
      'matched_user_ids.csv'
    )
  }

  // Split the file content by lines
  const lines = fileContent.trim().split('\n')

  const userMatches: Record<string, string[]> = {}
  // Process each line
  lines.forEach((line) => {
    const row = line.split(',')
    const userId = row[0]
    const matchIds = row.slice(1)

    if (!userMatches[userId]) {
      userMatches[userId] = []
    }

    // Append match IDs to the user's entry in the map
    userMatches[userId].push(...matchIds)
  })
  return userMatches
}

const fetchData = async function () {
  if (!dataLoaded) {
    if (!fetchPromise) {
      const load = async () => {
        logger.warn('Fetching sanctions data to store in memory')
        const query = `
        SELECT id, documentIds, arrayConcat([name], aka) AS names, data
        FROM sanctions_data 
        WHERE 
            # Hack for PNB
            (arrayCount(x -> x IN ('MY','ZZ', 'XX'), nationality) > 0) 
            OR nationality IS NULL 
            OR length(nationality) = 0`
        let results: {
          id: string
          documentIds: string[]
          names: string[]
          data: string
        }[] = []
        if (envIs('test')) {
          const filePath = path.join(
            __dirname,
            './__tests__/ongoing_search_results.json'
          )
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          results = JSON.parse(fileContent)
        } else {
          results = await executeClickhouseQuery<{
            id: string
            documentIds: string[]
            names: string[]
            data: string
          }>('flagright', query, {})
        }
        // Store data into maps
        results.forEach((result) => {
          sanctionEntities.set(result.id, JSON.parse(result.data))
          result.names.forEach((upperCaseName) => {
            const name = upperCaseName.toLowerCase()
            const ids = nameToIds.get(name) || []
            ids.push(result.id)
            nameToIds.set(name, ids)

            const names = namesByLength.get(name.length) || []
            names.push(name)
            namesByLength.set(name.length, names)
          })
          result.documentIds.forEach((documentId) => {
            const ids = documentIdToIds.get(documentId) || []
            ids.push(result.id)
            documentIdToIds.set(documentId, ids)
          })
        })

        userMatches = await getUserMatches()
      }
      fetchPromise = load()
    }
    await fetchPromise
    dataLoaded = true
  }
}

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
      if (request.documentId?.length && hit.documents?.length) {
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

      if (request.yearOfBirth && hit.yearOfBirth) {
        matchTypes.push('year_of_birth')
      }
      if (request.gender && hit.gender && request.gender === hit.gender) {
        matchTypes.push('gender')
      }
      if (
        request.fuzzinessRange?.upperBound &&
        request.fuzzinessRange?.upperBound < 100
      ) {
        matchTypes.push('name_fuzzy')
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
    if (request.documentId?.length && request.allowDocumentMatches) {
      const matchDocumentCondition = {
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
      .collection(SANCTIONS_COLLECTION)
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

    if (request.countryCodes) {
      match['countryCodes'] = { $in: request.countryCodes }
    }
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

    if (request.allowDocumentMatches && request.documentId) {
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

    if (!request.allowDocumentMatches && request.documentId?.length) {
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
          $match: { ...match, searchScore: { $gt: searchScoreThreshold } },
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
    if (request.ongoingSearchUserId) {
      return this.searchInMemory(request)
    }
    if (
      !request.manualSearch &&
      (request.fuzzinessRange?.upperBound === 100 || request.fuzziness === 100)
    ) {
      return this.searchWithoutMatchingNames(request)
    }
    return this.searchWithMatchingNames(request)
  }

  async searchInMemory(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    await fetchData()
    const results: SanctionsEntity[] = []

    let fuzzinessThreshold = 0
    if (request.fuzzinessRange?.upperBound) {
      fuzzinessThreshold = request.fuzzinessRange?.upperBound
    } else if (request.fuzziness) {
      fuzzinessThreshold = request.fuzziness * 100
    }
    const allowedDifference = fuzzinessThreshold / 100

    const matchingIds: string[] =
      userMatches[request.ongoingSearchUserId || ''] || []

    for (const entityId of uniq(matchingIds)) {
      const entity = sanctionEntities.get(entityId)
      if (!entity) {
        continue
      }
      const andConditions: boolean[] = []
      const orConditions: boolean[] = []

      const searchTerm = request.searchTerm.toLowerCase()
      if (allowedDifference === 0) {
        andConditions.push(entity.name.toLowerCase() === searchTerm)
      } else {
        const allNames = [entity?.name || '', ...(entity?.aka || [])].map((n) =>
          n.toLowerCase()
        )
        andConditions.push(
          allNames.some((n) => {
            const percentageDifference =
              100 - calculateLevenshteinDistancePercentage(n, searchTerm)
            return percentageDifference < allowedDifference * 100
          })
        )
      }

      // Country Codes
      if (request.countryCodes) {
        andConditions.push(
          entity.countryCodes?.some((code: string) =>
            request.countryCodes?.includes(code)
          ) ?? false
        )
      }

      // Year of Birth
      const yearOfBirthMatch =
        !request.yearOfBirth ||
        entity.yearOfBirth === `${request.yearOfBirth}` ||
        !entity.yearOfBirth
      ;(request.orFilters?.includes('yearOfBirth')
        ? orConditions
        : andConditions
      ).push(yearOfBirthMatch)

      // Types
      if (request.types) {
        const typeMatch =
          (entity.sanctionSearchTypes?.some((type) =>
            request.types?.includes(type)
          ) ||
            entity.associates?.some((associate) =>
              associate.sanctionsSearchTypes?.some((type) =>
                request.types?.includes(type)
              )
            )) ??
          false
        ;(request.orFilters?.includes('types')
          ? orConditions
          : andConditions
        ).push(typeMatch)
      }

      // Document ID
      if (request.documentId) {
        const documentIdMatch =
          request.documentId.length > 0
            ? request.documentId.some((docId) =>
                entity.documents?.some(
                  (doc) => doc.id === docId || doc.formattedId === docId
                )
              )
            : false

        ;(request.orFilters?.includes('documentId')
          ? orConditions
          : andConditions
        ).push(request.allowDocumentMatches === documentIdMatch)
      }

      // Nationality
      const nationality = request.nationality
      if (nationality) {
        const nationalityMatch =
          entity.nationality?.some((nat: string) =>
            [...nationality, 'XX', 'ZZ'].includes(nat)
          ) ?? false
        ;(request.orFilters?.includes('nationality')
          ? orConditions
          : andConditions
        ).push(
          nationalityMatch ||
            !entity.nationality ||
            entity.nationality.length === 0
        )
      }

      // Occupation Code
      if (request.occupationCode) {
        andConditions.push(
          entity.occupations?.some(
            (occupation) =>
              occupation.occupationCode &&
              request.occupationCode?.includes(occupation.occupationCode)
          ) ?? false
        )
      }

      // PEP Rank
      if (request.PEPRank) {
        andConditions.push(
          entity.occupations?.some(
            (occupation) => occupation.rank == request.PEPRank
          ) ?? false
        )
      }

      // Gender
      if (request.gender) {
        const genderMatch =
          entity.gender === request.gender ||
          !entity.gender ||
          entity.gender === 'Unknown'
        ;(request.orFilters?.includes('gender')
          ? orConditions
          : andConditions
        ).push(genderMatch)
      }

      // Combine Conditions
      const isMatch =
        andConditions.every(Boolean) &&
        (orConditions.length === 0 || orConditions.some(Boolean))
      if (isMatch) {
        results.push(entity)
      }
    }
    return this.searchRepository.saveSearch(
      this.hydrateHitsWithMatchTypes(results, request),
      request
    )
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
