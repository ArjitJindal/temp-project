import { LogicFunction } from './types'

export const LOWERCASE: LogicFunction<string> = {
  key: 'lowercase',
  group: 'string',
  uiDefinition: {
    label: 'Lowercase',
    returnType: 'text',
    args: {
      str: {
        label: 'String',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: string[]) => {
    return value?.toLowerCase()
  },
}
export const UPPERCASE: LogicFunction<string> = {
  key: 'uppercase',
  group: 'string',
  uiDefinition: {
    label: 'Uppercase',
    returnType: 'text',
    args: {
      str: {
        label: 'String',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([value]: string[]) => {
    return value?.toUpperCase()
  },
}
