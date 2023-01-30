import { TransactionRiskFactorValueHandler } from '.'

export const ARS_CARD_ISSUED_COUNTRY_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'cardIssuedCountry',
    handler: async (transaction) => {
      const paymentDetails = transaction.originPaymentDetails

      return paymentDetails?.method === 'CARD'
        ? [paymentDetails['cardIssuedCountry']]
        : []
    },
  },
]
