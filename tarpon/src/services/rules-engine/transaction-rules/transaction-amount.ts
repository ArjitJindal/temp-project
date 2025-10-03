import { JSONSchemaType } from 'ajv'
import mapValues from 'lodash/mapValues'
import random from 'lodash/random'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type TransactionAmountRuleParameters = {
  transactionAmountThreshold: {
    [currency: string]: number
  }
}

@traceable
export default class TransactionAmountRule extends TransactionRule<TransactionAmountRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({}),
      },
      required: ['transactionAmountThreshold'],
    }
  }

  public async computeRule() {
    const { transactionAmountThreshold } = this.parameters

    const thresholdHit = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      mapValues(transactionAmountThreshold, (threshold) => ({
        min: threshold,
      })),
      this.dynamoDb
    )

    const hitResult: RuleHitResult = []
    if (thresholdHit != null) {
      let falsePositiveDetails
      if (this.ruleInstance.falsePositiveCheckEnabled) {
        if (
          this.transaction.originAmountDetails &&
          thresholdHit.min &&
          (this.transaction.originAmountDetails.transactionAmount -
            thresholdHit.min) /
            this.transaction.originAmountDetails.transactionAmount <
            0.05
        ) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: random(60, 80),
          }
        }
      }

      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          limit: thresholdHit.min?.toFixed(2),
          currency: thresholdHit.currency,
        },
        falsePositiveDetails: falsePositiveDetails,
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('origin'),
          limit: thresholdHit.min?.toFixed(2),
          currency: thresholdHit.currency,
        },
        falsePositiveDetails: falsePositiveDetails,
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }
}
