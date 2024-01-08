import { createTransactionCountryCodeRuleVariable } from './utils/variables'

export const TRANSACTION_ORIGIN_COUNTRY =
  createTransactionCountryCodeRuleVariable({
    key: 'transaction.originAmountDetails.country',
    label: 'origin country',
    load: async (transaction) => transaction?.originAmountDetails?.country,
  })

export const TRANSACTION_DESTINATION_COUNTRY =
  createTransactionCountryCodeRuleVariable({
    key: 'transaction.destinationAmountDetails.country',
    label: 'destination country',
    load: async (transaction) => transaction?.destinationAmountDetails?.country,
  })
