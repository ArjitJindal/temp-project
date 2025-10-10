import { Aggregator } from './aggregator'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export class UserTransactionCountries extends Aggregator {
  public static aggregatorName = 'UserTransactionCountries'
  public async aggregate(transaction: Transaction): Promise<void> {
    await Promise.all([
      transaction.originUserId &&
        transaction.originAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          transaction.originUserId,
          transaction.originAmountDetails.country,
          'sendingFrom'
        ),
      transaction.originUserId &&
        transaction.destinationAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          transaction.originUserId,
          transaction.destinationAmountDetails.country,
          'sendingTo'
        ),
      transaction.destinationUserId &&
        transaction.originAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          transaction.destinationUserId,
          transaction.originAmountDetails.country,
          'receivingFrom'
        ),
      transaction.destinationUserId &&
        transaction.destinationAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          transaction.destinationUserId,
          transaction.destinationAmountDetails.country,
          'receivingTo'
        ),
    ])
  }

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }

  public async rebuildAggregation(_userId: string): Promise<void> {
    // TODO: Implement me
  }
}
