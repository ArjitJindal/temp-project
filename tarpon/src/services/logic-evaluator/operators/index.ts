import { CONTAINS_OPERATOR, NOT_CONTAINS_OPERATOR } from './contains'
import { MATCH_LIST_OPERATOR, NOT_MATCHLIST_OPERATOR } from './match-list'
import { NOT_SIMILAR_TO_OPERATOR, SIMILAR_TO_OPERATOR } from './similar-to'
import {
  NOT_SIMILAR_TO_WORDS_OPERATOR,
  SIMILAR_TO_WORDS_OPERATOR,
} from './similar-to-words'
import { ENDS_WITH_OPERATOR, STARTS_WITH_OPERATOR } from './starts-ends-with'
import { EQUAL_ARRAY_OPERATOR } from './equal-array'
import {
  BETWEEN_TIME_OPERATOR,
  NOT_BETWEEN_TIME_OPERATOR,
} from './between-time'
import { LogicOperator } from './types'
import { NOT_REGEX_MATCH_OPERATOR, REGEX_MATCH_OPERATOR } from './regex-match'
import { HAS_ITEMS_OPERATOR } from './hasItems'
import { CUSTOM_BUILT_IN_LOGIC_OPERATORS } from './custom-built-in-operators'
import {
  TIME_DIFFERENCE_GREATER_THAN,
  TIME_DIFFERENCE_LESSER_THAN,
} from './time-difference-comparison'
import {
  CONTAINS_IN_LISTS_OPERATOR,
  NOT_CONTAINS_IN_LISTS_OPERATOR,
} from './contains-in-lists'
import {
  NOT_SIMILAR_TO_LISTS_OPERATOR,
  SIMILAR_TO_LISTS_OPERATOR,
} from './similar-to-lists'
import { INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR } from './internalLeviDistance'

const _LOGIC_OPERATORS: LogicOperator[] = [
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
  REGEX_MATCH_OPERATOR,
  NOT_REGEX_MATCH_OPERATOR,
  BETWEEN_TIME_OPERATOR,
  NOT_BETWEEN_TIME_OPERATOR,
  TIME_DIFFERENCE_GREATER_THAN,
  TIME_DIFFERENCE_LESSER_THAN,
  CONTAINS_IN_LISTS_OPERATOR,
  NOT_CONTAINS_IN_LISTS_OPERATOR,
  SIMILAR_TO_LISTS_OPERATOR,
  NOT_SIMILAR_TO_LISTS_OPERATOR,
]

export const LOGIC_OPERATORS: LogicOperator[] = _LOGIC_OPERATORS.map(
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
  '<',
  '<=',
  '>',
  '>=',
  '!=',
  'in',
  '!',
  '!!',
  'some',
  'all',
  'none',
]

export const CUSTOM_INTERNAL_OPERATORS = [
  ...CUSTOM_BUILT_IN_LOGIC_OPERATORS,
  HAS_ITEMS_OPERATOR,
  EQUAL_ARRAY_OPERATOR,
  INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR,
]
