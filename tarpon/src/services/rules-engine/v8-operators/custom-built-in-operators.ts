import { isNil } from 'lodash'
import { RuleOperator } from './types'

export type CustomBuiltInRuleOperatorKeyType = '>' | '<' | '<=' | '>='

function getCustomBuiltInComparisonRuleOperators(
  key: CustomBuiltInRuleOperatorKeyType
): RuleOperator {
  return {
    key,
    uiDefinition: {
      label: key,
      valueTypes: ['number'],
      valueSources: ['value', 'field', 'func'],
    },
    run: async (
      lhs: number | null | undefined,
      rhs: number | null | undefined
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
          return lhs <= rhs
        case '>=':
          return lhs >= rhs
        default:
          return false
      }
    },
  } as RuleOperator
}

export const CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR =
  getCustomBuiltInComparisonRuleOperators('>')
export const CUSTOM_IN_BUILT_LESS_THAN_OPERATOR =
  getCustomBuiltInComparisonRuleOperators('<')
export const CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonRuleOperators('<=')
export const CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR =
  getCustomBuiltInComparisonRuleOperators('>=')

const _CUSTOM_BUILT_IN_RULE_OPERATORS = [
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
]
export const CUSTOM_BUILT_IN_RULE_OPERATORS: RuleOperator[] =
  _CUSTOM_BUILT_IN_RULE_OPERATORS.map((operator) => ({
    ...operator,
    uiDefinition: {
      ...operator.uiDefinition,
      jsonLogic: operator.key,
    },
  }))
