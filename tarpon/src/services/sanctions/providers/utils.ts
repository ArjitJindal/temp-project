import { compact } from 'lodash'
import { SanctionsDataFetcher } from './sanctions-data-fetcher'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { notEmpty } from '@/utils/array'
import { SanctionsNameMatchedMatchTypesEnum } from '@/@types/openapi-internal/SanctionsNameMatched'

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
    const matches = SanctionsDataFetcher.getFuzzinessEvaluationResult(
      searchRequest,
      similarity
    )

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
    const matches = SanctionsDataFetcher.getFuzzinessEvaluationResult(
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
) {
  const yearOfBirth =
    (entity.yearOfBirth != null && parseInt(entity.yearOfBirth)) || undefined
  if (searchRequest.yearOfBirth != null) {
    let matchTypes: SanctionsNameMatchedMatchTypesEnum[] = []
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
    return [
      {
        match_types: matchTypes,
        query_term: searchRequest.yearOfBirth.toString(),
      },
    ]
  }
  return []
}
