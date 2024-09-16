import { LogicOperator } from './types'
import { getNegatedOperator } from './utils'

export const BETWEEN_TIME_OPERATOR: LogicOperator<number, [number, number]> = {
  key: 'op:between_time',
  uiDefinition: {
    label: 'Between',
    valueTypes: ['time'],
    valueSources: ['value'],
    textSeparators: [null, 'and'],
    cardinality: 2,
    valueLabels: ['Start', 'End'],
  },
  run: async (target, values) => {
    if (values[1] < values[0]) {
      return target >= values[0] || target <= values[1]
    }

    return target >= values[0] && target <= values[1]
  },
}

export const NOT_BETWEEN_TIME_OPERATOR: LogicOperator<
  number,
  [number, number]
> = getNegatedOperator(BETWEEN_TIME_OPERATOR, 'Not Between')
