import { RuleOperator } from './types'

export function getNegatedOperator(
  operator: RuleOperator,
  label: string
): RuleOperator {
  return {
    key: `op:!${operator.key.split('op:')[1]}` as any,
    uiDefinition: {
      ...operator.uiDefinition,
      label,
    },
    run: async (lhs, rhs, context) => {
      const result = await operator.run(lhs, rhs, context)
      return !result
    },
  }
}
