import { RuleOperator } from './types'
import { getNegatedOperator } from './utils'

// Example walletname incoming is 'Mobiwik-1234' and the array is ['Mobiwik', 'Paytm']
export const CONTAINS_OPERATOR: RuleOperator<
  string | null | undefined,
  string[]
> = {
  key: 'op:contains',
  uiDefinition: {
    label: 'Contains',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (target, values) => {
    const targetLower = target?.toLowerCase()
    return values?.some((value) => {
      return targetLower?.includes(value.toLowerCase())
    })
  },
}
export const NOT_CONTAINS_OPERATOR = getNegatedOperator(
  CONTAINS_OPERATOR,
  'Not Contains'
)
