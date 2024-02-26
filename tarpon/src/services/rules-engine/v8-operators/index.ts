import { CONTAINS, NOT_CONTAINS } from './contains'
import { MATCH_LIST_OPERATOR, NOT_MATCHLIST_OPERATOR } from './match-list'
import { ENDS_WITH_OPERATOR, STARTS_WITH_OPERATOR } from './starts-ends-with'
import { RuleOperator } from './types'

const _RULE_OPERATORS: RuleOperator[] = [
  MATCH_LIST_OPERATOR,
  NOT_MATCHLIST_OPERATOR,
  CONTAINS,
  NOT_CONTAINS,
  STARTS_WITH_OPERATOR,
  ENDS_WITH_OPERATOR,
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
