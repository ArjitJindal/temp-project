import { Aggregator } from './aggregator'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'

const GRANULARITIES: Array<'day' | 'week' | 'month' | 'year'> = [
  'day',
  'week',
  'month',
  'year',
]

export class UserTransactionStatsTimeGroup extends Aggregator {
  public async aggregate(): Promise<void> {
    if (this.transaction.originUserId && this.transaction.originAmountDetails) {
      await this.aggregateUser(
        this.transaction.originUserId,
        'origin',
        this.transaction.originAmountDetails,
        this.transaction.originPaymentDetails?.method
      )
    }
    if (
      this.transaction.destinationUserId &&
      this.transaction.destinationAmountDetails
    ) {
      await this.aggregateUser(
        this.transaction.destinationUserId,
        'destination',
        this.transaction.destinationAmountDetails,
        this.transaction.destinationPaymentDetails?.method
      )
    }
  }

  private async aggregateUser(
    userId: string,
    direction: 'origin' | 'destination',
    transactionAmount: TransactionAmountDetails,
    paymentMethod: PaymentMethod | undefined
  ) {
    await Promise.all(
      GRANULARITIES.map((granularity) =>
        this.aggregationRepository.addUserTransactionStatsTimeGroup(
          userId,
          direction,
          transactionAmount,
          paymentMethod,
          this.transaction.timestamp!,
          granularity
        )
      )
    )
  }

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }
}
