import { Rule } from './rule'
import { RuleParameters } from '@/@types/rule/rule-instance'

type HighRiskCurrencyRuleParameters = RuleParameters & {
  highRiskCurrencies: string[]
}

export default class HighRiskCurrencyRule extends Rule<HighRiskCurrencyRuleParameters> {
  public async computeRule() {
    const sendingCurrency =
      this.transaction.sendingAmountDetails?.transactionCurrency
    const receivingCurrency =
      this.transaction.receivingAmountDetails?.transactionCurrency

    if (
      (sendingCurrency &&
        this.parameters.highRiskCurrencies.includes(sendingCurrency)) ||
      (receivingCurrency &&
        this.parameters.highRiskCurrencies.includes(receivingCurrency))
    ) {
      return {
        action: this.parameters.action,
      }
    }
  }
}
