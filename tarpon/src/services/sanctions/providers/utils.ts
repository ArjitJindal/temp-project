import { compact, intersection, uniq } from 'lodash'
import { isLatinScript, normalize, sanitizeString } from '@flagright/lib/utils'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import { SanctionsDataProviders, SanctionsSearchPropsWithData } from '../types'
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

export function getNameMatches(
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

export function getSecondaryMatches(
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

export function sanitizeAcurisEntities(
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

export function sanitizeOpenSanctionsEntities(
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
