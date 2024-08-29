import { isEmpty, uniqBy } from 'lodash'
import { Tag } from '@/@types/openapi-public/Tag'

export const tagsRuleFilter = (
  incomingTags: Tag[] | undefined,
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
  return uniqBy(
    (newRulesResults ?? []).concat(existingRulesResult ?? []),
    (r) => r.ruleInstanceId
  )
}
