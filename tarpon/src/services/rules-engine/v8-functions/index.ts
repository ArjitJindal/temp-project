import { LOWERCASE, UPPERCASE } from './case-conversion'
import { RuleFunction } from './types'

const _RULE_FUNCTIONS: RuleFunction[] = [
  // String
  LOWERCASE,
  UPPERCASE,
]

export const RULE_FUNCTIONS: RuleFunction[] = _RULE_FUNCTIONS.map((func) => ({
  ...func,
  uiDefinition: {
    ...func.uiDefinition,
    jsonLogic: func.key,
  },
}))
