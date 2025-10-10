import { JSONSchemaType } from 'ajv'
import { PAYMENT_METHODS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type PaymentMethodHistoricalRuleFilterParameter = {
  paymentMethodsHistorical?: PaymentMethod[]
}

const paymentMethodRuleFilterPredicate = (
  transaction: Transaction,
  paymentMethods: PaymentMethod[] | undefined
): boolean => {
  const originPaymentDetails = transaction.originPaymentDetails
  const destinationPaymentDetails = transaction.destinationPaymentDetails

  if (!paymentMethods?.length) {
    return true
  }

  if (
    originPaymentDetails &&
    paymentMethods.includes(originPaymentDetails.method)
  ) {
    return true
  }

  if (
    destinationPaymentDetails &&
    paymentMethods.includes(destinationPaymentDetails.method)
  ) {
    return true
  }

  return false
}

export class PaymentMethodHistoricalRuleFilter extends TransactionRuleFilter<PaymentMethodHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentMethodsHistorical: PAYMENT_METHODS_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction_historical' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (!this.parameters.paymentMethodsHistorical) {
      return true
    }

    return paymentMethodRuleFilterPredicate(
      this.transaction,
      this.parameters.paymentMethodsHistorical
    )
  }
}
