import { isEmpty, uniqBy } from 'lodash'
import { mergeRulesForPNB } from '../pnb-custom-logic'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { hasFeature } from '@/core/utils/context'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'
import { SanctionsSearchRequestEntityType } from '@/@types/openapi-internal/SanctionsSearchRequestEntityType'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'

export const tagsRuleFilter = (
  incomingTags: Tag[] | UserTag[] | undefined,
  filterTag: { [key: string]: string[] } | undefined
): boolean => {
  if (isEmpty(filterTag) || !filterTag) {
    return true
  }

  if (!incomingTags?.length) {
    return false
  }

  let isTagMatched = false

  incomingTags.forEach((incomingTag) => {
    if (!filterTag[incomingTag.key]) {
      return
    }

    if (filterTag[incomingTag.key].includes(incomingTag.value)) {
      isTagMatched = true
    }
  })

  return isTagMatched
}

export function mergeRules<T extends { ruleInstanceId: string }>(
  existingRulesResult: Array<T>,
  newRulesResults: Array<T>
): Array<T> {
  if (hasFeature('PNB')) {
    return mergeRulesForPNB(existingRulesResult, newRulesResults)
  }
  return uniqBy(
    (newRulesResults ?? []).concat(existingRulesResult ?? []),
    (r) => r.ruleInstanceId
  )
}

export function getEntityTypeForSearch(
  providers: SanctionsDataProviderName[],
  entity: SanctionsSearchRequestEntityType
): {
  entityType?: SanctionsSearchRequestEntityType
} {
  if (providers.includes('comply-advantage')) {
    return {}
  }
  return {
    entityType: entity,
  }
}

export function getFuzzinessSettings(
  providers: SanctionsDataProviderName[],
  fuzzinessSetting?: FuzzinessSettingOptions
): { fuzzinessSettings?: FuzzinessSetting } {
  if (providers.includes('comply-advantage')) {
    return {}
  }
  return fuzzinessSetting
    ? {
        fuzzinessSettings: {
          sanitizeInputForFuzziness:
            fuzzinessSetting === 'IGNORE_SPACES_AND_SPECIAL_CHARACTERS',
          similarTermsConsideration:
            fuzzinessSetting === 'TOKENIZED_SIMILARITY_MATCHING',
          levenshteinDistanceDefault:
            fuzzinessSetting === 'LEVENSHTEIN_DISTANCE_DEFAULT',
          jarowinklerDistance: fuzzinessSetting === 'JAROWINKLER_DISTANCE',
        },
      }
    : {}
}

export function getStopwordSettings(
  providers: SanctionsDataProviderName[],
  stopwords?: string[]
): {
  stopwords?: string[]
} {
  if (providers.includes('comply-advantage')) {
    return {}
  }
  return stopwords?.length
    ? {
        stopwords,
      }
    : {}
}

export function getIsActiveParameters(
  providers: SanctionsDataProviderName[],
  sanctionsSearchType?: Array<GenericSanctionsSearchType>,
  isActive?: boolean
): {
  isActivePep?: boolean
  isActiveSanctioned?: boolean
} {
  if (providers.includes('comply-advantage') || !isActive) {
    return {}
  }

  return {
    ...(sanctionsSearchType?.includes('PEP')
      ? {
          isActivePep: isActive,
        }
      : {}),
    ...(sanctionsSearchType?.includes('SANCTIONS')
      ? {
          isActiveSanctioned: isActive,
        }
      : {}),
  }
}
