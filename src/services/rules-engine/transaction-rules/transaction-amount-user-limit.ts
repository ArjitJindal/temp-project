import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
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
    if (
      await isTransactionAmountAboveThreshold(
        this.transaction.originAmountDetails,
        { [transactionLimit.amountCurrency]: transactionLimit.amountValue }
      )
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          transactionLimit,
        },
      }
    }
  }
}
