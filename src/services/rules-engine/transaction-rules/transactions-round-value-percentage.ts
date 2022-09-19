import TransactionsPatternPercentageBaseRule from './transactions-pattern-percentage-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

export default class TransactionsRoundValuePercentageRule extends TransactionsPatternPercentageBaseRule {
  protected matchPattern(
    transaction: Transaction,
    direction?: 'origin' | 'destination'
  ): boolean {
    const amount =
      direction === 'origin'
        ? transaction.originAmountDetails?.transactionAmount
        : transaction.destinationAmountDetails?.transactionAmount
    return amount ? this.isRoundValue(amount) : false
  }

  private isRoundValue(value: number) {
    return value % 100 === 0
  }
}
