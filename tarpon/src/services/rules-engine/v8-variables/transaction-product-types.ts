import { TransactionRuleVariable } from './types'

export const TRANSACTION_PRODUCT_TYPE: TransactionRuleVariable<
  string | undefined
> = {
  key: 'transaction.productType',
  entity: 'TRANSACTION',
  uiDefinition: {
    label: 'product type',
    type: 'string',
  },
  load: async (transaction) => {
    return transaction.productType
  },
}
