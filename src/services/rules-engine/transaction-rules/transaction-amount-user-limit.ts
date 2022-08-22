import { isTransactionAmountAboveThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { Amount } from '@/@types/openapi-public/Amount'

export default class TransactionAmountUserLimitRule extends TransactionRule<unknown> {
  public static getSchema(): any {
    return {}
  }

  public getFilters() {
    return [
      () =>
        this.senderUser?.transactionLimits?.maximumTransactionLimit !==
        undefined,
    ]
  }

  public async computeRule() {
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
