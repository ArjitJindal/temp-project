import { JSONSchemaType } from 'ajv'
import { PAYMENT_METHODS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { paymentMethodRuleFilterPredicate } from './payment-method'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'

export type PaymentMethodHistoricalRuleFilterParameter = {
  paymentMethodsHistorical?: PaymentMethod[]
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
