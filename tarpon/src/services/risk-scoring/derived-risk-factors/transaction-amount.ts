import { TransactionRiskFactorValueHandler } from '.'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

export const ARS_TRANSACTION_AMOUNT_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<TransactionAmountDetails>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'originAmountDetails.transactionAmount',
    handler: async (transaction) => {
      if (transaction?.originAmountDetails) {
        return [transaction?.originAmountDetails]
      }
      return []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'destinationAmountDetails.transactionAmount',
    handler: async (transaction) => {
      if (transaction?.destinationAmountDetails) {
        return [transaction?.destinationAmountDetails]
      }
      return []
    },
  },
]
