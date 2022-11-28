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
    if (
      await isTransactionAmountAboveThreshold(
        this.transaction.originAmountDetails,
        { [transactionLimit.amountCurrency]: transactionLimit.amountValue }
      )
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactionLimit,
        },
      })
    }
    return hitResult
  }
}
