import { isEmpty, uniqBy } from 'lodash'
import { mergeRulesForPNB } from '../pnb-custom-logic'
import { Tag } from '@/@types/openapi-public/Tag'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { hasFeature } from '@/core/utils/context'

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
