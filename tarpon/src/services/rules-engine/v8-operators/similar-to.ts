import { getEditDistancePercentage } from '@flagright/lib/utils'
import { isArray } from 'lodash'
import { TextRuleOperator } from './types'
import { getNegatedOperator } from './utils'
import { FUZZINESS_PARAMETER } from './similar-to-words'
import { logger } from '@/core/logger'

export const SIMILAR_TO_OPERATOR: TextRuleOperator = {
  key: 'op:similarto',
  uiDefinition: {
    label: 'Similar to',
    valueTypes: ['text'],
    valueSources: ['value', 'field', 'func'],
  },
  parameters: [FUZZINESS_PARAMETER],
  run: async (lhs, rhs, parameters) => {
    if (!lhs) {
      return false
    }
    const values = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    const percentageThreshold = parameters?.[0]
    if (percentageThreshold == null) {
      logger.error('Fuzziness parameter is required for similar to operator')
      return false
    }
    return values.some(
      (value) =>
        getEditDistancePercentage(lhs.toLowerCase(), value.toLowerCase()) <=
        percentageThreshold
    )
  },
}

export const NOT_SIMILAR_TO_OPERATOR = getNegatedOperator(
  SIMILAR_TO_OPERATOR,
  'Not similar to'
)
