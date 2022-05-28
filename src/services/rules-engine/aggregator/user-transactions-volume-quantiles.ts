import { Aggregator } from './aggregator'
import { TimeGranularity } from '@/core/dynamodb/dynamodb-keys'

export class UserTransactionsVolumeQuantiles extends Aggregator {
  public shouldAggregate(): boolean {
    return this.transaction.transactionState === 'SUCCESSFUL'
  }

  public async aggregate(): Promise<void> {
    const granularities: TimeGranularity[] = ['day', 'month', 'year']

    if (this.transaction.originUserId && this.transaction.originAmountDetails) {
      const userId = this.transaction.originUserId
      const transactionAmount = this.transaction.originAmountDetails
      await Promise.all(
        granularities.map((granularity) =>
          this.aggregationRepository.addUserTransactionsVolumeQuantiles(
            userId,
            'sending',
            transactionAmount,
            this.transaction.timestamp!,
            granularity
          )
        )
      )
    }
    if (
      this.transaction.destinationUserId &&
      this.transaction.destinationAmountDetails
    ) {
      const userId = this.transaction.destinationUserId
      const transactionAmount = this.transaction.destinationAmountDetails
      await Promise.all(
        granularities.map((granularity) =>
          this.aggregationRepository.addUserTransactionsVolumeQuantiles(
            userId,
            'receiving',
            transactionAmount,
            this.transaction.timestamp!,
            granularity
          )
        )
      )
    }
  }
}
