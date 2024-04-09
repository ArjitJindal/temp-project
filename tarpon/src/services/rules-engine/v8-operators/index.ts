import { CONTAINS_OPERATOR, NOT_CONTAINS_OPERATOR } from './contains'
import { MATCH_LIST_OPERATOR, NOT_MATCHLIST_OPERATOR } from './match-list'
import { NOT_SIMILAR_TO_OPERATOR, SIMILAR_TO_OPERATOR } from './similar-to'
import {
  NOT_SIMILAR_TO_WORDS_OPERATOR,
  SIMILAR_TO_WORDS_OPERATOR,
} from './similar-to-words'
import { ENDS_WITH_OPERATOR, STARTS_WITH_OPERATOR } from './starts-ends-with'
import {
  BETWEEN_TIME_OPERATOR,
  NOT_BETWEEN_TIME_OPERATOR,
} from './between-time'
import { RuleOperator } from './types'

const _RULE_OPERATORS: RuleOperator[] = [
  MATCH_LIST_OPERATOR,
  NOT_MATCHLIST_OPERATOR,
  CONTAINS_OPERATOR,
  NOT_CONTAINS_OPERATOR,
  STARTS_WITH_OPERATOR,
  ENDS_WITH_OPERATOR,
  SIMILAR_TO_OPERATOR,
  NOT_SIMILAR_TO_OPERATOR,
  SIMILAR_TO_WORDS_OPERATOR,
  NOT_SIMILAR_TO_WORDS_OPERATOR,
  BETWEEN_TIME_OPERATOR,
  NOT_BETWEEN_TIME_OPERATOR,
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

export const JSON_LOGIC_BUILT_IN_OPERATORS = [
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  '!',
  '!!',
  'some',
  'all',
  'none',
]
