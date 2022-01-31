import { RuleParameters } from '../../@types/rule/rule-instance'
import { Rule, RuleInfo } from './rule'

type HighRiskCurrencyRuleParameters = RuleParameters & {
  highRiskCurrencies: string[]
}

export default class HighRiskCurrencyRule extends Rule<HighRiskCurrencyRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'high_risk_currency',
      displayName: 'High risk currency',
      description: 'Transaction in a currency that is designated as high risk',
    }
  }

  public async computeRule() {
    const { transactionCurrency: sendingCurrency } =
      this.transaction.sendingAmountDetails
    const { transactionCurrency: receivingCurrency } =
      this.transaction.receivingAmountDetails

    if (
      this.parameters.highRiskCurrencies.includes(sendingCurrency) ||
      this.parameters.highRiskCurrencies.includes(receivingCurrency)
    ) {
      return {
        action: this.parameters.action,
      }
    }
  }
}
