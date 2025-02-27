import { isNil } from 'lodash'
import { LogicOperator } from './types'

export enum CustomBuiltInLogicOperatorKey {
  GREATER_THAN = '>',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL_TO = '<=',
  GREATER_THAN_OR_EQUAL_TO = '>=',
  IN = 'in',
}

function getCustomBuiltInComparisonLogicOperators(
  key: CustomBuiltInLogicOperatorKey
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

export const CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR = {
  key: CustomBuiltInLogicOperatorKey.IN,
  uiDefinition: {
    label: 'Any in',
    valueTypes: ['multiselect', 'text'],
  },
  run: async (
    lhs: string | null | undefined,
    rhs: string[] | number[] | null | undefined
  ) => {
    if (isNil(lhs) || isNil(rhs)) {
      return false
    }

    const rhsArray = (rhs ?? []).map((item: string | number) => {
      if (typeof item === 'number') {
        return item.toString()
      }
      return item
    })

    return rhsArray.some((item) => item === lhs)
  },
}

export const CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.GREATER_THAN
  )
export const CUSTOM_IN_BUILT_LESS_THAN_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.LESS_THAN
  )
export const CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.LESS_THAN_OR_EQUAL_TO
  )
export const CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonLogicOperators(
    CustomBuiltInLogicOperatorKey.GREATER_THAN_OR_EQUAL_TO
  )

const _CUSTOM_BUILT_IN_LOGIC_OPERATORS = [
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR,
]
export const CUSTOM_BUILT_IN_LOGIC_OPERATORS: LogicOperator[] =
  _CUSTOM_BUILT_IN_LOGIC_OPERATORS.map((operator) => ({
    ...operator,
    uiDefinition: {
      ...operator.uiDefinition,
      jsonLogic: operator.key,
    },
  }))
