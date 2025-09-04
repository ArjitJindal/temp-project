import { isEmpty, uniqBy } from 'lodash'
import { mergeRulesForPNB } from '../pnb-custom-logic'
import { GenericScreeningValues } from '../user-rules/generic-sanctions-consumer-user'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { hasFeature } from '@/core/utils/context'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { FuzzinessSetting } from '@/@types/openapi-internal/FuzzinessSetting'
import { SanctionsSearchRequestEntityType } from '@/@types/openapi-internal/SanctionsSearchRequestEntityType'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
import { PaymentDetailsName } from '@/utils/helpers'
import dayjs from '@/utils/dayjs'
import { Address } from '@/@types/openapi-public/Address'
import { SanctionsDataProviders } from '@/services/sanctions/types'

export const tagsRuleFilter = (
  incomingTags: Tag[] | UserTag[] | undefined,
  filterTag: { [key: string]: string[] } | undefined,
  useAndLogic?: boolean
): boolean => {
  if (isEmpty(filterTag) || !filterTag) {
    return true
  }

  if (!incomingTags?.length) {
    return false
  }

  if (useAndLogic) {
    // For AND logic, every key in filterTag must be present in incomingTags with at least one matching value
    return Object.entries(filterTag).every(([key, values]) =>
      incomingTags.some(
        (incomingTag) =>
          incomingTag.key === key && values.includes(incomingTag.value)
      )
    )
  } else {
    // OR logic (default): at least one tag matches
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
  entity: SanctionsSearchRequestEntityType
): {
  entityType?: SanctionsSearchRequestEntityType
} {
  return {
    entityType: entity,
  }
}

export function getFuzzinessSettings(
  fuzzinessSetting?: FuzzinessSettingOptions
): { fuzzinessSettings?: FuzzinessSetting } {
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

export function getEnableShortNameMatchingParameters(
  enableShortNameMatching?: boolean
): {
  enableShortNameMatching?: boolean
} {
  return {
    enableShortNameMatching,
  }
}

export function getEnablePhoneticMatchingParameters(
  enablePhoneticMatching?: boolean
): {
  enablePhoneticMatching?: boolean
} {
  return {
    enablePhoneticMatching,
  }
}

export function getStopwordSettings(stopwords?: string[]): {
  stopwords?: string[]
} {
  return stopwords?.length
    ? {
        stopwords,
      }
    : {}
}

export function getIsActiveParameters(
  sanctionsSearchType?: Array<GenericSanctionsSearchType>,
  isActive?: boolean
): {
  isActivePep?: boolean
  isActiveSanctioned?: boolean
} {
  if (!isActive) {
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

export function getPartialMatchParameters(partialMatch?: boolean): {
  partialMatch?: boolean
} {
  if (!partialMatch) {
    return {}
  }
  return {
    partialMatch,
  }
}

export function getScreeningValues(
  screeningValues?: GenericScreeningValues[],
  paymentDetails?: PaymentDetailsName
): {
  nationality?: Array<string>
  yearOfBirth?: number
} {
  if (!paymentDetails || !screeningValues) {
    return {}
  }
  return {
    ...(paymentDetails.countryOfNationality &&
    screeningValues?.includes('NATIONALITY')
      ? { nationality: [paymentDetails.countryOfNationality] }
      : {}),
    ...(paymentDetails.dateOfBirth && screeningValues?.includes('YOB')
      ? { yearOfBirth: dayjs(paymentDetails.dateOfBirth).year() }
      : {}),
  }
}

export function getFuzzyAddressMatchingParameters(
  providers: SanctionsDataProviderName[],
  fuzzyAddressMatching?: boolean,
  addresses?: Address[]
): {
  addresses?: Address[]
} {
  if (
    providers.includes(SanctionsDataProviders.ACURIS) &&
    fuzzyAddressMatching &&
    addresses?.length
  ) {
    return {
      addresses,
    }
  }

  return {}
}
