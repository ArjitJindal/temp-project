import { Aggregator } from './aggregator'

const GRANULARITIES: Array<'day' | 'week' | 'month' | 'year'> = [
  'day',
  'week',
  'month',
  'year',
]

export class UserTransactionStatsTimeGroup extends Aggregator {
  public shouldAggregate(): boolean {
    return this.transaction.transactionState === 'SUCCESSFUL'
  }

  public async aggregate(): Promise<void> {
    const userId = this.transaction.originUserId
    const transactionAmount = this.transaction.originAmountDetails

    if (!userId || !transactionAmount) {
      return
    }

    await Promise.all(
      GRANULARITIES.map((granularity) =>
        this.aggregationRepository.addUserTransactionStatsTimeGroup(
          userId,
          transactionAmount,
          this.transaction.originPaymentDetails?.method,
          this.transaction.timestamp!,
          granularity
        )
      )
    )
  }
}
