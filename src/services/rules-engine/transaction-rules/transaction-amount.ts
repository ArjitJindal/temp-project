import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
}

export default class TransactionAmountRule extends TransactionRule<TransactionAmountRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA(),
      },
      required: ['transactionAmountThreshold'],
    }
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters

    const thresholdHit = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      _.mapValues(transactionAmountThreshold, (threshold) => ({
        min: threshold,
      }))
    )
    if (thresholdHit != null) {
      return {
        action: this.action,
        hitDirections: ['ORIGIN' as const, 'DESTINATION' as const],
        vars: {
          ...super.getTransactionVars('origin'),
          limit: thresholdHit.min?.toFixed(2),
          currency: thresholdHit.currency,
        },
      }
    }
  }
}
