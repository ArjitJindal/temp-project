import { LogicOperator } from './types'

export const HAS_ITEMS_OPERATOR: LogicOperator<
  Array<any> | undefined | null,
  boolean
> = {
  key: 'op:hasItems',
  uiDefinition: {
    label: 'isNotNullOrEmpty',
    valueTypes: ['array'],
    valueSources: ['value', 'field', 'func'],
    cardinality: 2,
  },
  run: async (lhs: Array<any> | undefined | null, rhs: boolean) => {
    if (lhs == null || lhs.length === 0) {
      return !rhs
    }
    return rhs
  },
}
