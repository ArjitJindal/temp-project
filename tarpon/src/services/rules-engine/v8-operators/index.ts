import { MATCH_LIST_OPERATOR, NOT_MATCHLIST_OPERATOR } from './match-list'
import { RuleOperator } from './types'

const _RULE_OPERATORS: RuleOperator[] = [
  MATCH_LIST_OPERATOR,
  NOT_MATCHLIST_OPERATOR,
]

export const RULE_OPERATORS: RuleOperator[] = _RULE_OPERATORS.map(
  (operator) => ({
    ...operator,
    uiDefinition: {
      ...operator.uiDefinition,
      jsonLogic: operator.key,
    },
  })
)
