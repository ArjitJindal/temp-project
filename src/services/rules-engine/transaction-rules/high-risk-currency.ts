import { JSONSchemaType } from 'ajv'
import { TransactionRule } from './rule'

export type HighRiskCurrencyRuleParameters = {
  highRiskCurrencies: string[]
}

export default class HighRiskCurrencyRule extends TransactionRule<HighRiskCurrencyRuleParameters> {
  public static getSchema(): JSONSchemaType<HighRiskCurrencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        highRiskCurrencies: { type: 'array', items: { type: 'string' } },
      },
      required: ['highRiskCurrencies'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const sendingCurrency =
      this.transaction.originAmountDetails?.transactionCurrency
    const receivingCurrency =
      this.transaction.destinationAmountDetails?.transactionCurrency

    if (
      (sendingCurrency &&
        this.parameters.highRiskCurrencies.includes(sendingCurrency)) ||
      (receivingCurrency &&
        this.parameters.highRiskCurrencies.includes(receivingCurrency))
    ) {
      return {
        action: this.action,
      }
    }
  }
}
