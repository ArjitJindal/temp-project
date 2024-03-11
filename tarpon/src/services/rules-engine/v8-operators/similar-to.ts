import * as levenshtein from 'fast-levenshtein'
import { RuleOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'

export const SIMILAR_TO_OPERATOR: RuleOperator<string, string[]> = {
  key: 'op:similarto',
  uiDefinition: {
    label: 'Similar to',
    valueSources: ['value'],
    valueTypes: ['text'],
  },
  parameters: [
    {
      title: 'Fuzziness %',
      description:
        'The allowed Levenshtein distance as a percentage of the length of the string. For example specifying 50% means that the allowed Levenshtein distance will be half of the number of characters in the string.',
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
  ],
  run: async (lhs, rhs, parameters) => {
    const percentageThreshold = parameters?.[0]
    if (percentageThreshold == null) {
      logger.error('Fuzziness parameter is required for similar to operator')
      return false
    }
    return rhs.some((value) => {
      const result = levenshtein.get(lhs, value) / lhs.length
      return result <= percentageThreshold / 100
    })
  },
}

export const NOT_SIMILAR_TO_OPERATOR = getNegatedOperator(
  SIMILAR_TO_OPERATOR,
  'Not similar to'
)
