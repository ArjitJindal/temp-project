import { RuleParameters } from '../../../@types/rule/rule-instance'
import { Rule, RuleInfo } from './rule'

type HighRiskCurrencyRuleParameters = RuleParameters & {
  highRiskCurrencies: string[]
}

export default class HighRiskCurrencyRule extends Rule<HighRiskCurrencyRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'high_risk_currency',
      displayName: 'Transaction in a currency that is designated as high risk',
      description:
        'Transaction includes a currency that is designated as high risk. Mostly relevant for when you are moving funds between different currencies. This rule uses a customizable list.',
    }
  }

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
