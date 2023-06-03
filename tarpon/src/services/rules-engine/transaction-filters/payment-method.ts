import { JSONSchemaType } from 'ajv'
import { PAYMENT_METHODS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function paymentMethodRuleFilterPredicate(
  transaction: Transaction,
  paymentMethods?: PaymentMethod[]
): boolean {
  if (!paymentMethods?.length) {
    return true
  }

  const originPaymentMethod = transaction?.originPaymentDetails?.method
  const destinationPaymentMethod =
    transaction?.destinationPaymentDetails?.method

  if (originPaymentMethod && paymentMethods.includes(originPaymentMethod)) {
    return true
  }

  if (
    destinationPaymentMethod &&
    paymentMethods.includes(destinationPaymentMethod)
  ) {
    return true
  }

  return false
}

export type PaymentMethodRuleFilterParameter = {
  paymentMethods?: PaymentMethod[]
}

export class PaymentMethodRuleFilter extends TransactionRuleFilter<PaymentMethodRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentMethods: PAYMENT_METHODS_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return paymentMethodRuleFilterPredicate(
      this.transaction,
      this.parameters?.paymentMethods
    )
  }
}
