import { createTransactionListRuleVariable } from './utils/variables'

export const TRANSACTION_ORIGIN_PAYMENT_CHANNEL =
  createTransactionListRuleVariable<string | undefined>({
    key: 'transaction.originPaymentDetails.paymentChannel',
    label: 'origin payment channel',
    load: async (transaction) => {
      if (transaction?.originPaymentDetails?.method === 'CARD') {
        return transaction?.originPaymentDetails.paymentChannel
      }
    },
  })

export const TRANSACTION_DESTINATION_PAYMENT_CHANNEL =
  createTransactionListRuleVariable<string | undefined>({
    key: 'transaction.destinationPaymentDetails.paymentChannel',
    label: 'destination payment channel',
    load: async (transaction) => {
      if (transaction?.destinationPaymentDetails?.method === 'CARD') {
        return transaction?.destinationPaymentDetails.paymentChannel
      }
    },
  })
