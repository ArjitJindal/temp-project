import * as _ from 'lodash'
import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { Amount } from '@/@types/openapi-public/Amount'

export default class TransactionAmountUserLimitRule extends TransactionRule<unknown> {
  public static getSchema(): any {
    return {}
  }

  public async computeRule() {
    if (!this.senderUser?.transactionLimits?.maximumTransactionLimit) {
      return
    }

    const transactionLimit = this.senderUser?.transactionLimits
      ?.maximumTransactionLimit as Amount
    const hitResult: RuleHitResult = []
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      this.transaction.originAmountDetails,
      { [transactionLimit.amountCurrency]: transactionLimit.amountValue }
    )
    if (transactionAmountHit.isHit) {
      const { thresholdHit } = transactionAmountHit
      let falsePositiveDetails
      if (
        this.ruleInstance.falsePositiveCheckEnabled &&
        thresholdHit != null &&
        this.ruleInstance.caseCreationType === 'TRANSACTION'
      ) {
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
            confidenceScore: _.random(60, 80),
          }
        }
      }
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactionLimit,
        },
        falsePositiveDetails: falsePositiveDetails,
      })
    }
    return hitResult
  }
}
