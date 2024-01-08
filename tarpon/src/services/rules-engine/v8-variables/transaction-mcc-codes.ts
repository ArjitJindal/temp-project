import { createTransactionListRuleVariable } from './utils/variables'

export const TRANSACTION_ORIGIN_MCC_CODES = createTransactionListRuleVariable<
  string | undefined
>({
  key: 'transaction.originPaymentDetails.merchantDetails.MCC',
  label: 'transaction origin mcc codes',
  load: async (transaction) => {
    if (transaction?.originPaymentDetails?.method === 'CARD') {
      return transaction?.originPaymentDetails.merchantDetails?.MCC
    }
  },
})

export const TRANSACTION_DESTINATION_MCC_CODES =
  createTransactionListRuleVariable<string | undefined>({
    key: 'transaction.destinationPaymentDetails.merchantDetails.MCC',
    label: 'transaction destination mcc codes',
    load: async (transaction) => {
      if (transaction?.destinationPaymentDetails?.method === 'CARD') {
        return transaction?.destinationPaymentDetails.merchantDetails?.MCC
      }
    },
  })
