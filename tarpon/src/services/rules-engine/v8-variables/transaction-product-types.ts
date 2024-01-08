import { createTransactionListRuleVariable } from './utils/variables'

export const TRANSACTION_PRODUCT_TYPE = createTransactionListRuleVariable<
  string | undefined
>({
  key: 'transaction.productType',
  label: 'transaction product type',
  load: async (transaction) => {
    return transaction.productType
  },
})
