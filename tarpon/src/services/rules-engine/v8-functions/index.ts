import { LOWERCASE, UPPERCASE } from './case-conversion'
import { TIMESTAMP_DIFF_SECONDS } from './timestamp-diff-seconds'
import { TRUNCATE_DECIMAL } from './truncate-decimals'
import { NUMBER_TO_STRING, STRING_TO_NUMBER } from './type-convertion'
import { RuleFunction } from './types'

const _RULE_FUNCTIONS: RuleFunction[] = [
  TRUNCATE_DECIMAL,
  STRING_TO_NUMBER,
  NUMBER_TO_STRING,
  LOWERCASE,
  UPPERCASE,
  TIMESTAMP_DIFF_SECONDS,
]

export const RULE_FUNCTIONS: RuleFunction[] = _RULE_FUNCTIONS.map((func) => ({
  ...func,
  uiDefinition: {
    ...func.uiDefinition,
    jsonLogic: func.key,
  },
}))
