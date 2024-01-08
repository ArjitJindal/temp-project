import { lowerCase, startCase } from 'lodash'
import { createTransactionListRuleVariable } from './utils/variables'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'

const OPTIONS = {
  fieldSettings: {
    listValues: PAYMENT_METHODS.map((method) => ({
      value: method,
      title: startCase(lowerCase(method)),
    })),
  },
  type: 'select' as const,
}
export const TRANSACTION_ORIGIN_PAYMENT_METHOD =
  createTransactionListRuleVariable<PaymentMethod | undefined>({
    key: 'transaction.originPaymentDetails.method',
    label: 'origin payment method',
    load: async (transaction) =>
      transaction.originPaymentDetails?.method as PaymentMethod | undefined,
    uiDefinition: OPTIONS,
  })

export const TRANSACTION_DESTINATION_PAYMENT_METHOD =
  createTransactionListRuleVariable<PaymentMethod | undefined>({
    key: 'transaction.destinationPaymentDetails.method',
    label: 'destination payment method',
    load: async (transaction) =>
      transaction.destinationPaymentDetails?.method as
        | PaymentMethod
        | undefined,
    uiDefinition: OPTIONS,
  })
