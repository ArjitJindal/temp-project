import isArray from 'lodash/isArray'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'

export const CONTAINS_OPERATOR: TextLogicOperator = {
  key: 'op:contains',
  uiDefinition: {
    label: 'Contains',
    valueTypes: ['text'],
    valueSources: ['value', 'field', 'func'],
  },
  run: async (target, rhs) => {
    const values = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    return values?.some((value) => {
      return target?.toLowerCase()?.includes((value as string).toLowerCase())
    })
  },
}
export const NOT_CONTAINS_OPERATOR = getNegatedOperator(
  CONTAINS_OPERATOR,
  'Not contains'
)
