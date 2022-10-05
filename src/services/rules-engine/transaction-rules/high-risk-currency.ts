import { JSONSchemaType } from 'ajv'
import { CURRENRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'

export type HighRiskCurrencyRuleParameters = {
  highRiskCurrencies: string[]
}

export default class HighRiskCurrencyRule extends TransactionRule<HighRiskCurrencyRuleParameters> {
  public static getSchema(): JSONSchemaType<HighRiskCurrencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        highRiskCurrencies: CURRENRIES_SCHEMA({
          title: 'High Risk Currencies',
        }),
      },
      required: ['highRiskCurrencies'],
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
