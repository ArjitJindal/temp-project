import { LogicFunction } from './types'

export const TRUNCATE_DECIMAL: LogicFunction<number> = {
  key: 'truncate_decimal',
  group: 'number',
  uiDefinition: {
    label: 'Truncate Decimal',
    returnType: 'number',
    args: {
      num: {
        label: 'Number',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: number[]) => {
    return Math.trunc(value)
  },
}
