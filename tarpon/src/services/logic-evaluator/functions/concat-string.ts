import { LogicFunction, LogicFunctionKey } from './types'

export const CONCAT_STRING: LogicFunction<string> = {
  key: LogicFunctionKey.CONCAT_STRING,
  group: 'string',
  uiDefinition: {
    label: 'Concat String',
    returnType: 'text',
    args: {
      v1: {
        label: 'String 1',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
        tooltip: 'String 1',
      },
      v2: {
        label: 'String 2',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
        tooltip: 'String 2',
      },
    },
  },
  run: async ([v1, v2]: string[]) => {
    if (!v1 || !v2) {
      return ''
    }

    return `${v1} ${v2}`
  },
}
