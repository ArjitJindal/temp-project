import { RuleOperator } from './types'

export function getNegatedOperator(
  operator: RuleOperator,
  label: string
): RuleOperator {
  return {
    ...operator,
    key: `op:!${operator.key.split('op:')[1]}` as any,
    uiDefinition: {
      ...operator.uiDefinition,
      label,
    },
    run: async (...args) => {
      const result = await operator.run(...args)
      return !result
    },
  }
}
