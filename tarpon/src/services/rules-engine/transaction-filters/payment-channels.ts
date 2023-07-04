import { JSONSchemaType } from 'ajv'
import { PAYMENT_CHANNELs_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'

export type PaymentChannelsRuleFilterParameter = {
  paymentChannels?: string[]
}

export class PaymentChannelsRuleFilter extends TransactionRuleFilter<PaymentChannelsRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<PaymentChannelsRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        paymentChannels: PAYMENT_CHANNELs_OPTIONAL_SCHEMA({
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (!this.parameters?.paymentChannels?.length) {
      return true
    }

    if (this.transaction.originPaymentDetails?.method === 'CARD') {
      const paymentChannel =
        this.transaction.originPaymentDetails?.paymentChannel
      if (paymentChannel) {
        return this.parameters.paymentChannels.includes(paymentChannel)
      }
    }

    return false
  }
}
