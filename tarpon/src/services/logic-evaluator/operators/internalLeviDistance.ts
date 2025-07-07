import { getEditDistance } from '@flagright/lib/utils'
import { isArray } from 'lodash'
import { TextLogicOperator } from './types'
import { FUZZINESS_PARAMETER } from './similar-to-words'
import { removePrefixFromName } from '@/services/rules-engine/utils/transaction-rule-utils'
import { extractFirstAndLastName } from '@/services/rules-engine/transaction-rules/payment-method-name-levensthein-distance'

export const INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR: TextLogicOperator = {
  key: 'op:internalLevenshteinDistance',
  uiDefinition: {
    label: 'Internal Levenshtein Distance',
    valueTypes: ['text'],
    valueSources: ['value', 'field', 'func'],
  },
  parameters: [FUZZINESS_PARAMETER],
  run: async (lhs, rhs, parameters) => {
    const allowedDistancePercentage = parameters[0]
    if (
      rhs === undefined ||
      rhs === null ||
      lhs === undefined ||
      lhs === null
    ) {
      return false
    }
    const str1 = lhs
    const str2 = isArray(rhs) ? rhs[0] : rhs
    const userName = str1.toLowerCase()
    const paymentMethodNameWithoutPrefix = removePrefixFromName(str2, true)
    const paymentMethodNameWithoutPrexiAndMiddleNames = extractFirstAndLastName(
      paymentMethodNameWithoutPrefix
    )

    const minDistance = Math.min(
      ...[str2, paymentMethodNameWithoutPrexiAndMiddleNames].map((str) => {
        return getEditDistance(userName?.toLowerCase() || '', str || '')
      })
    )

    if (
      minDistance >
      (allowedDistancePercentage / 100) * (userName?.length || 0)
    ) {
      return true
    }

    return false
  },
}
