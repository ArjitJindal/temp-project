import { LogicFunction, LogicFunctionKey } from './types'
import dayjs from '@/utils/dayjs'

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

export const STRING_TO_TIMESTAMP: LogicFunction<number> = {
  key: LogicFunctionKey.STRING_TO_TIMESTAMP,
  group: 'string',
  uiDefinition: {
    label: 'String to Timestamp',
    returnType: 'datetime',
    args: {
      str: {
        label: 'string',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: string[]) => {
    const convertedValue = Number(value)
    if (Number.isNaN(convertedValue)) {
      return 0
    }
    return dayjs(convertedValue).valueOf()
  },
}
