import { TransactionRiskFactorValueHandler } from '.'

export const ARS_3DSDONE_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<boolean | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: '_3dsDone',
    handler: async (transaction) => {
      const paymentDetails = transaction.originPaymentDetails

      return paymentDetails?.method === 'CARD'
        ? [paymentDetails['_3dsDone']]
        : []
    },
  },
]
