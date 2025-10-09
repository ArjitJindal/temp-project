import isArray from 'lodash/isArray'
import { TextLogicOperator } from './types'

export const STARTS_WITH_OPERATOR: TextLogicOperator = {
  key: 'op:startswith',
  uiDefinition: {
    label: 'Starts with',
    valueTypes: ['text'],
    valueSources: ['value', 'field', 'func'],
  },
  run: async (lhs, rhs) => {
    if (!lhs) {
      return false
    }
    const lhsValue = lhs.toLowerCase()
    const values = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    return values.some((substr) => lhsValue.startsWith(substr.toLowerCase()))
  },
}

export const ENDS_WITH_OPERATOR: TextLogicOperator = {
  key: 'op:endswith',
  uiDefinition: {
    label: 'Ends with',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (lhs, rhs) => {
    if (!lhs) {
      return false
    }
    const lhsValue = lhs.toLowerCase()
    const values = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    return values.some((substr) => lhsValue.endsWith(substr.toLowerCase()))
  },
}
