import { LogicFunction, LogicFunctionKey } from './types'

const arraylen = (inputArray: any[]) => {
  if (!Array.isArray(inputArray)) {
    return 0
  }
  return inputArray.length
}

export const NUMBER_OF_ITEMS: LogicFunction<number> = {
  key: LogicFunctionKey.NUMBER_OF_ITEMS,
  group: 'number',
  uiDefinition: {
    label: 'Number of Items',
    returnType: 'number',
    args: {
      inputArray: {
        label: 'Input Array',
        type: 'multiselect',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([inputArray]: any[]): Promise<number> => {
    return arraylen(inputArray)
  },
}
export const NUMBER_OF_OBJECTS: LogicFunction<number> = {
  key: LogicFunctionKey.NUMBER_OF_OBJECTS,
  group: 'number',
  uiDefinition: {
    label: 'Number of Objects',
    returnType: 'number',
    args: {
      inputArray: {
        label: 'Input Array',
        type: '!group',
        valueSources: ['field', 'func'],
      },
    },
  },
  run: async ([inputArray]: any[]): Promise<number> => {
    return arraylen(inputArray)
  },
}
