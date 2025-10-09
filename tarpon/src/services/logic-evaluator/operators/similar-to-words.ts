import { getEditDistancePercentage } from '@flagright/lib/utils'
import isArray from 'lodash/isArray'
import { JSONSchemaType } from 'ajv'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'

export const FUZZINESS_PARAMETER: JSONSchemaType<any> = {
  title: 'Fuzziness %',
  description:
    'Fuzziness adjusts how closely strings must match. Lower values mean stricter matching—for example, 20% allows up to 20% character differences.',
  type: 'number',
  minimum: 0,
  maximum: 100,
  format: 'input',
}

export const SIMILAR_TO_WORDS_OPERATOR: TextLogicOperator = {
  key: 'op:similartowords',
  uiDefinition: {
    label: 'Similar to (words)',
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

    const lhsWords = lhs.toLowerCase().trim().split(/\s+/)
    const rhsWords = values.map((word) => word.toLowerCase().trim())

    for (const lhsWord of lhsWords) {
      for (const rhsWord of rhsWords) {
        if (
          getEditDistancePercentage(lhsWord, rhsWord) <= percentageThreshold
        ) {
          return true
        }
      }
    }

    return false
  },
}

export const NOT_SIMILAR_TO_WORDS_OPERATOR: TextLogicOperator =
  getNegatedOperator(SIMILAR_TO_WORDS_OPERATOR, 'Not similar to (words)')
