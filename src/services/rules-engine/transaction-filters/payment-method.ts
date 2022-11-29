import { JSONSchemaType } from 'ajv'

import _ from 'lodash'
import { PAYMENT_METHOD_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { PaymentMethods } from '@/@types/openapi-public/PaymentMethods'

export type PaymentMethodRuleFilterParameter = {
  paymentMethod?: PaymentMethods
}

export class PaymentMethodRuleFilter extends TransactionRuleFilter<PaymentMethodRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentMethodRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return (
      this.transaction.originPaymentDetails?.method ===
        this.parameters.paymentMethod ||
      this.transaction.destinationPaymentDetails?.method ===
        this.parameters.paymentMethod
    )
  }
}
