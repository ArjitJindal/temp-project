import { Func } from '@react-awesome-query-builder/ui';
import { LogicFunction } from '@/apis';

type JsonLogicFunc = Func & Required<Pick<Func, 'jsonLogic' | 'jsonLogicImport'>>;

function getArithmeticFunc(label: string, op: string): JsonLogicFunc {
  return {
    label,
    returnType: 'number',
    jsonLogic: ({ v1, v2 }) => ({ [op]: [v1, v2] }),
    jsonLogicImport: (v) => {
      const v1 = v[op][0];
      const v2 = v[op][1];
      return [v1, v2];
    },
    args: {
      v1: {
        label: 'Value 1',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
      v2: {
        label: 'Value 2',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
    },
  };
}

export const JSON_LOGIC_FUNCTIONS: LogicFunction[] = [
  {
    key: 'add',
    group: 'number',
    uiDefinition: getArithmeticFunc('Add (+)', '+'),
  },
  {
    key: 'subtract',
    group: 'number',
    uiDefinition: getArithmeticFunc('Subtract (-)', '-'),
  },
  {
    key: 'multiply',
    group: 'number',
    uiDefinition: getArithmeticFunc('Multiply (×)', '*'),
  },
  {
    key: 'divide',
    group: 'number',
    uiDefinition: getArithmeticFunc('Divide (÷)', '/'),
  },
  {
    key: 'modulo',
    group: 'number',
    uiDefinition: getArithmeticFunc('Modulo (%)', '%'),
  },
];

export const isValidRegex = (value: string) => {
  try {
    new RegExp(value);
    return true;
  } catch (e) {
    return false;
  }
};
