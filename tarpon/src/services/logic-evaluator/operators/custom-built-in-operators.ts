import { isNil } from 'lodash'
import { LogicOperator } from './types'

export type CustomBuiltInLogicOperatorKeyType = '>' | '<' | '<=' | '>='

function getCustomBuiltInComparisonLogicOperators(
  key: CustomBuiltInLogicOperatorKeyType
): LogicOperator {
  return {
    key,
    uiDefinition: {
      label: key,
      valueTypes: ['number'],
      valueSources: ['value', 'field', 'func'],
    },
    run: async (
      lhs: number | null | undefined,
      rhs: number | null | undefined,
      parameters?: number
    ) => {
      if (isNil(lhs) || isNil(rhs)) {
        return false
      }
      switch (key) {
        case '>':
          return lhs > rhs
        case '<':
          return lhs < rhs
        case '<=':
          // <= is used for 'Between' operator
          if (parameters != null && Number.isFinite(parameters)) {
            return lhs <= rhs && rhs <= parameters
          }
          return lhs <= rhs
        case '>=':
          return lhs >= rhs
        default:
          return false
      }
    },
  } as LogicOperator
}

export const CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators('>')
export const CUSTOM_IN_BUILT_LESS_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators('<')
export const CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators('<=')
export const CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators('>=')

const _CUSTOM_BUILT_IN_LOGIC_OPERATORS = [
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
]
export const CUSTOM_BUILT_IN_LOGIC_OPERATORS: LogicOperator[] =
  _CUSTOM_BUILT_IN_LOGIC_OPERATORS.map((operator) => ({
    ...operator,
    uiDefinition: {
      ...operator.uiDefinition,
      jsonLogic: operator.key,
    },
  }))
