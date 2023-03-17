import { JSONSchemaType } from 'ajv'
import { PAYMENT_METHOD_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { paymentMethodRuleFilterPredicate } from './payment-method'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'

export type PaymentMethodHistoricalRuleFilterParameter = {
  paymentMethodHistorical?: PaymentMethod
}

export class PaymentMethodHistoricalRuleFilter extends TransactionRuleFilter<PaymentMethodHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentMethodHistorical: PAYMENT_METHOD_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction_historical' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return paymentMethodRuleFilterPredicate(
      this.transaction,
      this.parameters.paymentMethodHistorical
    )
  }
}
