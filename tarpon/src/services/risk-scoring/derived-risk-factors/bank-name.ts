import { TransactionRiskFactorValueHandler } from '.'
import { Transaction } from '@/@types/openapi-internal/Transaction'

const getBankName = (paymentDetails: Transaction['originPaymentDetails']) => {
  switch (paymentDetails?.method) {
    case 'GENERIC_BANK_ACCOUNT':
    case 'ACH':
    case 'IBAN':
    case 'SWIFT':
      return paymentDetails.bankName
    default:
      return undefined
  }
}

export const ARS_BANK_NAME_RISK_HANDLERS: Array<
  TransactionRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'TRANSACTION',
    parameter: 'originPaymentDetails.bankName',
    handler: async (value) => {
      const paymentDetails = value.originPaymentDetails
      const bankName = getBankName(paymentDetails)
      return bankName != null ? [bankName] : []
    },
  },
  {
    entityType: 'TRANSACTION',
    parameter: 'destinationPaymentDetails.bankName',
    handler: async (value) => {
      const paymentDetails = value.destinationPaymentDetails
      const bankName = getBankName(paymentDetails)
      return bankName != null ? [bankName] : []
    },
  },
]
