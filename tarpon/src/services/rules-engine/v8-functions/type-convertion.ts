import { RuleFunction } from './types'

export const NUMBER_TO_STRING: RuleFunction<string> = {
  key: 'number_to_string',
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
  run: async (value: string) => {
    return value.toString()
  },
}

export const STRING_TO_NUMBER: RuleFunction<number> = {
  key: 'string_to_number',
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
  run: async (value: string) => {
    return Number.isNaN(Number(value)) ? 0 : Number(value)
  },
}
