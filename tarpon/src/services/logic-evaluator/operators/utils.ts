import { LogicOperator } from './types'

export function getNegatedOperator(
  operator: LogicOperator,
  label: string
): LogicOperator {
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
