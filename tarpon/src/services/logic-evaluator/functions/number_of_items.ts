import { LogicFunction } from './types'

const arraylen = (inputArray: any) => {
  if (!Array.isArray(inputArray) || !Array.isArray(inputArray[0])) {
    return 0
  }
  return inputArray[0].length
}

export const NUMBER_OF_ITEMS: LogicFunction<number> = {
  key: 'number_of_items',
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
  run: async (inputArray: any): Promise<number> => {
    return arraylen(inputArray)
  },
}
export const NUMBER_OF_OBJECTS: LogicFunction<number> = {
  key: 'number_of_objects',
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
  run: async (inputArray: any): Promise<number> => {
    return arraylen(inputArray)
  },
}
