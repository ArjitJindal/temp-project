import { createTransactionCountryCodeRuleVariable } from './utils/variables'
import { CountryCode } from '@/@types/openapi-public/CountryCode'

export const TRANSACTION_ORIGIN_CARD_ISSUED_COUNTRIES =
  createTransactionCountryCodeRuleVariable({
    key: 'transaction.originPaymentDetails.cardIssuedCountry',
    label: 'origin card issued country',
    load: async (transaction) => {
      if (transaction?.originPaymentDetails?.method === 'CARD') {
        return transaction?.originPaymentDetails.cardIssuedCountry as
          | CountryCode
          | undefined
      }
    },
  })

export const TRANSACTION_DESTINATION_CARD_ISSUED_COUNTRIES =
  createTransactionCountryCodeRuleVariable({
    key: 'transaction.destinationPaymentDetails.cardIssuedCountry',
    label: 'destination card issued country',
    load: async (transaction) => {
      if (transaction?.destinationPaymentDetails?.method === 'CARD') {
        return transaction?.destinationPaymentDetails.cardIssuedCountry as
          | CountryCode
          | undefined
      }
    },
  })
