import { LogicFunction, LogicFunctionKey } from './types'

export const NUMBER_TO_STRING: LogicFunction<string> = {
  key: LogicFunctionKey.NUMBER_TO_STRING,
  group: 'number',
  uiDefinition: {
    label: 'Number to String',
    returnType: 'text',
    args: {
      num: {
        label: 'number',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: number[]) => {
    return value?.toString() ?? ''
  },
}

export const STRING_TO_NUMBER: LogicFunction<number> = {
  key: LogicFunctionKey.STRING_TO_NUMBER,
  group: 'string',
  uiDefinition: {
    label: 'String to Number',
    returnType: 'number',
    args: {
      str: {
        label: 'string',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: string[]) => {
    return Number.isNaN(Number(value)) ? 0 : Number(value)
  },
}
