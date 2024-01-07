import { TransactionRuleVariable } from './types'

export const TRANSACTION_PRODUCT_TYPE: TransactionRuleVariable<
  string | undefined
> = {
  key: 'transaction.productType',
  entity: 'TRANSACTION',
  valueType: 'string',
  uiDefinition: {
    label: 'product type',
    type: 'text',
    valueSources: ['value', 'field', 'func'],
  },
  load: async (transaction) => {
    return transaction.productType
  },
}
