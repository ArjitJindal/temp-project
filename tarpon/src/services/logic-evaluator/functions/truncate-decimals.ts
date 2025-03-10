import { LogicFunction, LogicFunctionKey } from './types'

export const TRUNCATE_DECIMAL: LogicFunction<number> = {
  key: LogicFunctionKey.TRUNCATE_DECIMAL,
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
