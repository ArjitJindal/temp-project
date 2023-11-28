import { TransactionRiskFactorValueHandler } from '.'

export const ARS_MCC_CODE_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'originMccCode',
    handler: async (transaction) => {
      const paymentDetails = transaction.originPaymentDetails

      return paymentDetails?.method === 'CARD'
        ? [paymentDetails.merchantDetails?.MCC]
        : []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'destinationMccCode',
    handler: async (transaction) => {
      const paymentDetails = transaction.destinationPaymentDetails

      return paymentDetails?.method === 'CARD'
        ? [paymentDetails.merchantDetails?.MCC]
        : []
    },
  },
]
