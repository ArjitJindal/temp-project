import { JSONSchemaType } from 'ajv'
import { PAYMENT_METHOD_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethods } from '@/@types/openapi-public/PaymentMethods'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function paymentMethodRuleFilterPredicate(
  transaction: Transaction,
  paymentMethod?: PaymentMethods
) {
  return (
    transaction.originPaymentDetails?.method === paymentMethod ||
    transaction.destinationPaymentDetails?.method === paymentMethod
  )
}

export type PaymentMethodRuleFilterParameter = {
  paymentMethod?: PaymentMethods
}

export class PaymentMethodRuleFilter extends TransactionRuleFilter<PaymentMethodRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return paymentMethodRuleFilterPredicate(
      this.transaction,
      this.parameters.paymentMethod
    )
  }
}
