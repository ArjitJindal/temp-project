import { isEmpty, uniqBy } from 'lodash'
import { mergeRulesForPNB } from '../pnb-custom-logic'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { hasFeature } from '@/core/utils/context'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'

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
  provider: SanctionsDataProviderName,
  entity: SanctionsEntityType
): {
  entityType?: SanctionsEntityType
} {
  if (provider === 'comply-advantage') {
    return {}
  }
  if (provider === 'acuris' && entity === 'BANK') {
    return {
      entityType: 'BUSINESS',
    }
  }
  return {
    entityType: entity,
  }
}

export function getFuzzinessSettings(
  provider: SanctionsDataProviderName,
  fuzzinessSetting?: FuzzinessSettingOptions
): { fuzzinessSettings?: FuzzinessSetting } {
  if (provider === 'comply-advantage') {
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
        },
      }
    : {}
}

export function getStopwordSettings(
  provider: SanctionsDataProviderName,
  stopwords?: string[]
): {
  stopwords?: string[]
} {
  if (provider === 'comply-advantage') {
    return {}
  }
  return stopwords?.length
    ? {
        stopwords,
      }
    : {}
}
