import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'

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
      return rhs.some((r) => {
        try {
          return new RegExp(r).test(value)
        } catch (error) {
          logger.error('Error matching regex', error)
          return false
        }
      })
    }
    if (typeof rhs === 'string') {
      try {
        return new RegExp(rhs).test(value)
      } catch (error) {
        return false
      }
    }
    return false
  },
}
export const NOT_REGEX_MATCH_OPERATOR = getNegatedOperator(
  REGEX_MATCH_OPERATOR,
  'Not regex match'
)
