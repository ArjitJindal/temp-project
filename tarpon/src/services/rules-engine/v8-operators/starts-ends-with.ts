import { RuleOperator } from './types'

export const STARTS_WITH_OPERATOR: RuleOperator<string, string[]> = {
  key: 'op:startswith',
  uiDefinition: {
    label: 'Starts with',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (value, substrs) => {
    return substrs.some((substr) => value.startsWith(substr))
  },
}

export const ENDS_WITH_OPERATOR: RuleOperator<string, string[]> = {
  key: 'op:endswith',
  uiDefinition: {
    label: 'Ends with',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (value, substrs) => {
    return substrs.some((substr) => value.endsWith(substr))
  },
}
