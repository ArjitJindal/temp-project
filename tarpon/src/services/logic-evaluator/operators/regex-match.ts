import XRegExp from 'xregexp'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'

export const REGEX_MATCH_OPERATOR: TextLogicOperator = {
  key: 'op:regexmatch',
  uiDefinition: {
    label: 'Regex match',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (value, rhs, _params) => {
    if (!value || !rhs) {
      return false
    }
    if (Array.isArray(rhs)) {
      return rhs.some((r) => XRegExp(r).test(value))
    }
    if (typeof rhs === 'string') {
      return XRegExp(rhs).test(value)
    }
    return false
  },
}
export const NOT_REGEX_MATCH_OPERATOR = getNegatedOperator(
  REGEX_MATCH_OPERATOR,
  'Not regex match'
)
