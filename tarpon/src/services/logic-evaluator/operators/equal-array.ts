import { LogicOperator } from './types'

export const EQUAL_ARRAY_OPERATOR: LogicOperator<
  Array<any> | undefined | null,
  Array<any> | undefined | null
> = {
  key: 'op:equalArray',
  uiDefinition: {
    label: 'Equal Array',
    valueTypes: ['array'],
    valueSources: ['value', 'field', 'func'],
  },
  run: async (
    lhs: Array<any> | undefined | null,
    rhs: Array<any> | undefined | null
  ) => {
    if (lhs == null || rhs == null) {
      return false
    }
    return (
      lhs.length === rhs.length &&
      lhs.every((item, index) => item === rhs[index])
    )
  },
}
