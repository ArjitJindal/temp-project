import { createTransactionListRuleVariable } from './utils/variables'

export const TRANSACTION_ORIGIN_WALLET_TYPE = createTransactionListRuleVariable<
  string | undefined
>({
  key: 'transaction.originWalletDetails.walletType',
  label: 'origin transaction wallet type',
  load: async (transaction) => {
    if (transaction?.originPaymentDetails?.method === 'WALLET') {
      return transaction?.originPaymentDetails.walletType
    }
  },
})

export const TRANSACTION_DESTINATION_WALLET_TYPE =
  createTransactionListRuleVariable<string | undefined>({
    key: 'transaction.destinationWalletDetails.walletType',
    label: 'destination transaction wallet type',
    load: async (transaction) => {
      if (transaction?.destinationPaymentDetails?.method === 'WALLET') {
        return transaction?.destinationPaymentDetails.walletType
      }
    },
  })
