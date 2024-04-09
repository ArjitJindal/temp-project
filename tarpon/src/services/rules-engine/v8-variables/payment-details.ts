import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { TransactionRuleVariable } from './types'
import { getPaymentDetailsIdentifiers } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export const getPaymentDetailsIdentifiersKey = (
  paymentDetails: PaymentDetails
): string | undefined => {
  const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
  if (!identifiers) {
    return
  }
  const identifiersString = Object.entries(identifiers)
    .map((entry) => `${entry[0]}:${entry[1]}`)
    .join('#')
  return `${identifiersString}`
}

const getUiDefinition = (
  direction: 'ORIGIN' | 'DESTINATION'
): FieldOrGroup => ({
  label: `${
    direction === 'ORIGIN' ? 'sender' : 'receiver'
  } payment details identifier`,
  type: 'text',
  valueSources: ['value', 'field', 'func'],
})

const createPaymentDetailsIdentifier = (
  direction: 'ORIGIN' | 'DESTINATION'
): TransactionRuleVariable => {
  return {
    key: `${
      direction === 'ORIGIN' ? 'origin' : 'destination'
    }PaymentDetailsIdentifier`,
    entity: 'TRANSACTION',
    uiDefinition: getUiDefinition(direction),
    valueType: 'string',
    load: async (transaction) => {
      if (direction === 'ORIGIN') {
        return transaction.originPaymentDetails
          ? getPaymentDetailsIdentifiersKey(transaction.originPaymentDetails)
          : ''
      }
      return transaction.destinationPaymentDetails
        ? getPaymentDetailsIdentifiersKey(transaction.destinationPaymentDetails)
        : ''
    },
    sourceField:
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails',
  }
}

export const TRANSACTION_ORIGIN_PAYMENT_DETAILS_IDENTIFIER =
  createPaymentDetailsIdentifier('ORIGIN')
export const TRANSACTION_DESTINATION_PAYMENT_DETAILS_IDENTIFIER =
  createPaymentDetailsIdentifier('DESTINATION')
