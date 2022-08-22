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
        highRiskCurrencies: {
          type: 'array',
          title: 'High Risk Currencies',
          items: { type: 'string' },
        },
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

    const senderHit =
      sendingCurrency &&
      this.parameters.highRiskCurrencies.includes(sendingCurrency)
    const receiverHit =
      receivingCurrency &&
      this.parameters.highRiskCurrencies.includes(receivingCurrency)
    if (senderHit || receiverHit) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars(receiverHit ? 'destination' : 'origin'),
        },
      }
    }
  }
}
