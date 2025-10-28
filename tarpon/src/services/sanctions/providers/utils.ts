import compact from 'lodash/compact'
import intersection from 'lodash/intersection'
import uniq from 'lodash/uniq'
import {
  adverseMediaCategoryMap,
  isLatinScript,
  normalize,
  sanitizeString,
} from '@flagright/lib/utils'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import {
  SanctionsDataProviders,
  SanctionsSearchProps,
  SanctionsSearchPropsWithData,
} from '../types'
import { getDefaultProviders, getSanctionsCollectionName } from '../utils'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { notEmpty } from '@/utils/array'
import { SanctionsNameMatched } from '@/@types/openapi-internal/SanctionsNameMatched'
import { AcurisSanctionsSearchType } from '@/@types/openapi-internal/AcurisSanctionsSearchType'
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/AcurisSanctionsSearchType'
import { OpenSanctionsSearchType } from '@/@types/openapi-internal/OpenSanctionsSearchType'
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/OpenSanctionsSearchType'
import { getContext } from '@/core/utils/context-storage'
import { SanctionsMatchTypeDetailsEnum } from '@/@types/openapi-internal/SanctionsMatchTypeDetailsEnum'
import { generateHashFromString } from '@/utils/object'
import { SanctionsMatchTypeDetails } from '@/@types/openapi-internal/SanctionsMatchTypeDetails'
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { getNonDemoTenantId } from '@/utils/tenant-id'
import { ScreeningProfileService } from '@/services/screening-profile'
import { SanctionsSourceRelevance } from '@/@types/openapi-internal/SanctionsSourceRelevance'
import { PEPSourceRelevance } from '@/@types/openapi-internal/PEPSourceRelevance'
import { RELSourceRelevance } from '@/@types/openapi-internal/RELSourceRelevance'
import { AdverseMediaSourceRelevance } from '@/@types/openapi-internal/AdverseMediaSourceRelevance'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'

export function shouldLoadScreeningData<T>(
  screeningTypes: T[],
  entityTypes: SanctionsEntityType[]
) {
  return screeningTypes.length > 0 && entityTypes.length > 0
}

export function checkYearMatch(
  year1: number,
  year2: number,
  searchRequest: SanctionsSearchRequest
): 'EXACT' | 'FUZZY' | undefined {
  if (year1 === year2) {
    return 'EXACT'
  } else {
    const MAX_YEAR_DIFFERENCE = 20
    const yearDif = Math.min(MAX_YEAR_DIFFERENCE, Math.abs(year1 - year2))
    const similarity = 100 - (yearDif / MAX_YEAR_DIFFERENCE) * 100
    const matches = getFuzzinessEvaluationResult(searchRequest, similarity)

    if (matches) {
      return 'FUZZY'
    }
  }
}

function checkTermMatch(
  term1: string,
  term2: string,
  searchRequest: SanctionsSearchRequest
): 'EXACT' | 'FUZZY' | undefined {
  if (term1.toLowerCase() === term2.toLowerCase()) {
    return 'EXACT'
  } else {
    const percentageSimilarity = calculateLevenshteinDistancePercentage(
      term2,
      term1
    )
    const matches = getFuzzinessEvaluationResult(
      searchRequest,
      percentageSimilarity
    )

    if (matches) {
      return 'FUZZY'
    }
  }
}

function getNameMatches(
  entity: SanctionsEntity,
  searchRequest: SanctionsSearchRequest
) {
  // Search data
  const searchTerms = searchRequest.searchTerm.split(/\s+/)

  const nameTerms = entity.name.split(/\s+/)
  const akaTerms = entity.aka?.flatMap((aka) => aka.split(/\s+/)) ?? []
  const allNameTerms = [
    ...nameTerms.map((x) => ['NAME', x]),
    ...akaTerms.map((x) => ['AKA', x]),
  ]
  return searchTerms
    .map((searchTerm) => {
      const matchTypes = compact(
        allNameTerms.map(([field, nameTerm]) => {
          const nameMatch = checkTermMatch(searchTerm, nameTerm, searchRequest)
          if (nameMatch === 'EXACT') {
            return field === 'NAME' ? 'exact_match' : 'equivalent_name'
          } else if (nameMatch === 'FUZZY') {
            return field === 'NAME'
              ? 'edit_distance'
              : 'name_variations_removal'
          }
          return
        })
      )

      return {
        match_types: matchTypes,
        query_term: searchTerm,
      }
    })
    .filter(notEmpty)
}

export function deriveMatchingDetails(
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

function getSecondaryMatches(
  entity: SanctionsEntity,
  searchRequest: SanctionsSearchRequest
): SanctionsNameMatched[] {
  const secondaryMatches: SanctionsNameMatched[] = []
  const yearOfBirth =
    entity.yearOfBirth?.length && parseInt(entity.yearOfBirth[0])
  if (searchRequest.yearOfBirth != null) {
    let matchTypes: SanctionsMatchTypeDetailsEnum[] = []
    if (yearOfBirth != null) {
      const match = checkYearMatch(
        yearOfBirth,
        searchRequest.yearOfBirth,
        searchRequest
      )
      if (match === 'EXACT') {
        matchTypes = ['exact_birth_year_match']
      } else if (match === 'FUZZY') {
        matchTypes = ['fuzzy_birth_year_match']
      }
    }
    secondaryMatches.push({
      match_types: matchTypes,
      query_term: searchRequest.yearOfBirth.toString(),
      key: 'yearOfBirth',
    })
  }
  if (searchRequest.nationality != null) {
    secondaryMatches.push({
      match_types: entity.matchTypes?.includes('nationality')
        ? ['exact_nationality_match']
        : [],
      query_term: searchRequest.nationality.toString(),
      key: 'nationality',
    })
  }
  if (searchRequest.gender != null) {
    secondaryMatches.push({
      match_types: entity.matchTypes?.includes('gender')
        ? ['exact_gender_match']
        : [],
      query_term: searchRequest.gender.toString(),
      key: 'gender',
    })
  }
  if (searchRequest.documentId?.length) {
    secondaryMatches.push({
      match_types: entity.matchTypes?.includes('document_id')
        ? ['exact_document_id_match']
        : [],
      query_term: searchRequest.documentId.toString(),
      key: 'documentId',
    })
  }
  return secondaryMatches
}

export function getUniqueStrings(
  arr: string[],
  normalizeOnly?: boolean
): string[] {
  const strings: Set<string> = new Set<string>()
  for (const str of arr) {
    strings.add(normalizeOnly ? normalize(str) : sanitizeString(str))
  }

  return Array.from(strings)
}

export function getNameAndAka(
  name: string,
  aka: string[]
): {
  name: string
  aka: string[]
  normalizedAka: string[]
} {
  return {
    name,
    aka: uniq(compact([...aka])),
    normalizedAka: getUniqueStrings(uniq(compact([...aka, name])), true).filter(
      isLatinScript
    ),
  }
}

export async function sanitizeEntities(props: SanctionsSearchPropsWithData) {
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

function sanitizeAcurisEntities(
  props: SanctionsSearchPropsWithData
): SanctionsEntity[] {
  const {
    data: entities,
    sanctionSourceIds,
    pepSourceIds,
    relSourceIds,
    sanctionsCategory,
    pepCategory,
    relCategory,
    adverseMediaCategory,
  } = props
  const SCREENING_TYPES_TO_TYPES = {
    PEP: [
      'Current PEP',
      'Former PEP',
      'Linked to PEP (PEP by Association)',
      'Profile Of Interest',
    ],
    SANCTIONS: ['Current Sanctions', 'Former Sanctions'],
    ADVERSE_MEDIA: ['Reputational Risk Exposure'],
    REGULATORY_ENFORCEMENT_LIST: ['Regulatory Enforcement List'],
  }
  const sanctions = getContext()?.settings?.sanctions
  const acurisSettings = sanctions?.providerScreeningTypes?.find(
    (type) => type.provider === SanctionsDataProviders.ACURIS
  )
  const screeningTypes =
    (acurisSettings?.screeningTypes as AcurisSanctionsSearchType[]) ??
    ACURIS_SANCTIONS_SEARCH_TYPES
  const processedEntities: SanctionsEntity[] = []
  for (const entity of entities ?? []) {
    const sanctionSearchTypes = intersection(
      screeningTypes,
      entity.sanctionSearchTypes
    )
    const screeningTypesToTypesList = Object.entries(SCREENING_TYPES_TO_TYPES)
      .filter(([key, _value]) =>
        sanctionSearchTypes.includes(key as AcurisSanctionsSearchType)
      )
      .flatMap(([_key, value]) => value)
    const allowedSourceIds = generateHashFromString('')
    const processedEntity = {
      ...entity,
      sanctionSearchTypes,
      sanctionsSources: sanctionSearchTypes.includes('SANCTIONS')
        ? entity.sanctionsSources?.filter(
            (source) =>
              (!sanctionSourceIds?.length ||
                !source.internalId ||
                sanctionSourceIds.includes(source.internalId)) &&
              (!sanctionsCategory ||
                (source.category &&
                  sanctionsCategory
                    .map((cat) => humanizeAuto(cat).toLowerCase())
                    .includes(humanizeAuto(source.category).toLowerCase())))
          ) ??
          entity.sanctionsSources ??
          []
        : [],
      pepSources: sanctionSearchTypes.includes('PEP')
        ? entity.pepSources?.filter(
            (source) =>
              (!pepSourceIds?.length ||
                source.category === 'POI' ||
                !source.internalId ||
                allowedSourceIds.includes(source.internalId) ||
                pepSourceIds.includes(source.internalId)) &&
              (!pepCategory ||
                (source.category &&
                  pepCategory
                    .map((cat) => humanizeAuto(cat).toLowerCase())
                    .includes(humanizeAuto(source.category).toLowerCase())))
          ) ??
          entity.pepSources ??
          []
        : [],
      mediaSources: sanctionSearchTypes.includes('ADVERSE_MEDIA')
        ? entity.mediaSources?.filter(
            (source) =>
              !adverseMediaCategory ||
              (source.category &&
                adverseMediaCategory
                  .map((cat) => humanizeAuto(cat).toLowerCase())
                  .includes(humanizeAuto(source.category).toLowerCase()))
          ) ??
          entity.mediaSources ??
          []
        : [],
      otherSources: sanctionSearchTypes.includes('REGULATORY_ENFORCEMENT_LIST')
        ? entity.otherSources?.filter(
            (source) =>
              source.type === 'REGULATORY_ENFORCEMENT_LIST' &&
              (!relSourceIds?.length ||
                (source.value?.some(
                  (value) =>
                    !value.internalId || relSourceIds.includes(value.internalId)
                ) ??
                  false)) &&
              (!relCategory ||
                (source.value?.some(
                  (value) =>
                    value.category &&
                    relCategory
                      .map((cat) => humanizeAuto(cat).toLowerCase())
                      .includes(humanizeAuto(value.category).toLowerCase())
                ) ??
                  false))
          ) ??
          entity.otherSources ??
          []
        : [],
      isActiveSanctioned: sanctionSearchTypes.includes('SANCTIONS')
        ? entity.isActiveSanctioned
        : undefined,
      isActivePep: sanctionSearchTypes.includes('PEP')
        ? entity.isActivePep
        : undefined,
      types: entity.types?.filter((type) =>
        screeningTypesToTypesList.includes(type)
      ),
      associates: entity.associates?.map((a) => {
        return {
          ...a,
          sanctionsSearchTypes: intersection(
            screeningTypes,
            a.sanctionsSearchTypes
          ),
        }
      }),
    }
    if (processedEntity.sanctionSearchTypes?.length) {
      processedEntities.push(processedEntity)
    }
  }
  return processedEntities
}

function sanitizeOpenSanctionsEntities(
  entities: SanctionsEntity[]
): SanctionsEntity[] {
  const sanctions = getContext()?.settings?.sanctions
  const openSanctionSettings = sanctions?.providerScreeningTypes?.find(
    (type) => type.provider === SanctionsDataProviders.OPEN_SANCTIONS
  )
  const types =
    (openSanctionSettings?.screeningTypes as OpenSanctionsSearchType[]) ??
    OPEN_SANCTIONS_SEARCH_TYPES
  const processedEntities: SanctionsEntity[] = []
  for (const entity of entities) {
    const screeningTypes = intersection(entity.sanctionSearchTypes, types)
    const processedEntity = {
      ...entity,
      sanctionSearchTypes: screeningTypes,
      mediaSources: undefined,
      sanctionsSources: undefined,
      pepSources: undefined,
      otherSources: undefined,
      associates: entity.associates?.map((a) => {
        return {
          ...a,
          sanctionsSearchTypes: intersection(types, a.sanctionsSearchTypes),
        }
      }),
    }
    if (processedEntity.sanctionSearchTypes?.length) {
      processedEntities.push(processedEntity)
    }
  }
  return processedEntities
}

export function getFuzzinessEvaluationResult(
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

export function hydrateHitsWithMatchTypes(
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

export function getEntityTypes(
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

export function getCollectionNames(
  request: SanctionsSearchRequest,
  providers: SanctionsDataProviderName[],
  tenantId: string,
  props?: {
    screeningProfileId?: string
    screeningProfileContainsAllSources?: boolean
  }
) {
  const { screeningProfileId, screeningProfileContainsAllSources } = props ?? {}
  const sanctions = getContext()?.settings?.sanctions
  const aggregateScreeningProfileData = sanctions?.aggregateScreeningProfileData
  const nonDemoTenantId = getNonDemoTenantId(tenantId)
  const entityTypes: SanctionsEntityType[] = getEntityTypes(request)
  return uniq(
    providers.flatMap((p) => {
      return entityTypes.map((entityType) =>
        getSanctionsCollectionName(
          {
            provider: p,
            entityType: entityType,
          },
          nonDemoTenantId,
          request.isOngoingScreening ? 'delta' : 'full',
          {
            screeningProfileId: screeningProfileId,
            aggregate: aggregateScreeningProfileData ?? false,
            screeningProfileContainsAllSources:
              screeningProfileContainsAllSources,
          }
        )
      )
    })
  )
}

export async function getSanctionSourceDetails(
  request: SanctionsSearchRequest,
  screeningProfileService: ScreeningProfileService
): Promise<SanctionsSearchProps> {
  let sanctionSourceIds: string[] | undefined = undefined
  let pepSourceIds: string[] | undefined = undefined
  let relSourceIds: string[] | undefined = undefined
  let sanctionsCategory: SanctionsSourceRelevance[] | undefined
  let pepCategory: PEPSourceRelevance[] | undefined
  let relCategory: RELSourceRelevance[] | undefined
  let adverseMediaCategory: AdverseMediaSourceRelevance[] | undefined
  let crimeCategory: string[] | undefined
  let containAllSources: boolean | undefined = undefined
  if (request.screeningProfileId) {
    const screeningProfileId = request.screeningProfileId
    const screeningProfile =
      await screeningProfileService.getExistingScreeningProfile(
        screeningProfileId
      )
    const screeningProfileData = getScreeningProfileData(screeningProfile)
    sanctionSourceIds = screeningProfileData.sanctionSourceIds
    pepSourceIds = screeningProfileData.pepSourceIds
    relSourceIds = screeningProfileData.relSourceIds
    sanctionsCategory = screeningProfileData.sanctionsCategory
    pepCategory = screeningProfileData.pepCategory
    relCategory = screeningProfileData.relCategory
    adverseMediaCategory = screeningProfileData.adverseMediaCategory
    crimeCategory = screeningProfileData.crimeCategory
    containAllSources = screeningProfileData.containAllSources
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
      if (!request.types.includes('CRIME')) {
        crimeCategory = []
      }
    }
  }
  return {
    sanctionSourceIds,
    pepSourceIds,
    relSourceIds,
    sanctionsCategory,
    pepCategory,
    relCategory,
    adverseMediaCategory,
    crimeCategory,
    containAllSources,
  }
}

export function getScreeningProfileData(
  screeningProfile: ScreeningProfileResponse
) {
  const sanctionSourceIds = screeningProfile.sanctions?.sourceIds
  const pepSourceIds = screeningProfile.pep?.sourceIds
  const relSourceIds = screeningProfile.rel?.sourceIds
  const sanctionsCategory = screeningProfile.sanctions?.relevance
  const pepCategory = screeningProfile.pep?.relevance
  const relCategory = screeningProfile.rel?.relevance
  const adverseMediaCategory = screeningProfile.adverseMedia?.relevance
  const containAllSources = screeningProfile.containAllSources
  const crimeCategory = screeningProfile.crime?.relevance
  return {
    sanctionSourceIds,
    pepSourceIds,
    relSourceIds,
    sanctionsCategory,
    pepCategory,
    relCategory,
    adverseMediaCategory,
    containAllSources,
    crimeCategory,
  }
}

export function getAggregatedSourceIds(props: SanctionsSearchProps) {
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

export function getFuzzinessThreshold(request: SanctionsSearchRequest): number {
  let fuzziness = request.fuzzinessRange?.upperBound
  if (fuzziness == null && request.fuzziness != null) {
    fuzziness = request.fuzziness * 100
  }
  if (fuzziness == null) {
    return 100
  }
  return fuzziness
}
