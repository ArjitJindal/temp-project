import { TransactionRiskFactorValueHandler } from '.'

export const ARS_3DSDONE_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<boolean | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: '3dsDone',
    handler: async (transaction) => {
      const paymentDetails = transaction.originPaymentDetails

      return paymentDetails?.method === 'CARD'
        ? [paymentDetails['3dsDone']]
        : []
    },
  },
]
