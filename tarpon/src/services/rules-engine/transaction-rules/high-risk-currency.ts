import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { CURRENCIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type HighRiskCurrencyRuleParameters = {
  highRiskCurrencies: string[]
}

@traceable
export default class HighRiskCurrencyRule extends TransactionRule<HighRiskCurrencyRuleParameters> {
  public static getSchema(): JSONSchemaType<HighRiskCurrencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        highRiskCurrencies: CURRENCIES_SCHEMA({
          title: 'High risk currencies',
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

    const hitResult: RuleHitResult = []
    if (senderHit || receiverHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: senderHit ? super.getTransactionVars('origin') : undefined,
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: receiverHit ? super.getTransactionVars('destination') : undefined,
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }
}
