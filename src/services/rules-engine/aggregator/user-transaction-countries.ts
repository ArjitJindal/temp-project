import { Aggregator } from './aggregator'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export class UserTransactionCountries extends Aggregator {
  public async aggregate(): Promise<void> {
    await Promise.all([
      this.transaction.originUserId &&
        this.transaction.originAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          this.transaction.originUserId,
          this.transaction.originAmountDetails.country,
          'sendingFrom'
        ),
      this.transaction.originUserId &&
        this.transaction.destinationAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          this.transaction.originUserId,
          this.transaction.destinationAmountDetails.country,
          'sendingTo'
        ),
      this.transaction.destinationUserId &&
        this.transaction.originAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          this.transaction.destinationUserId,
          this.transaction.originAmountDetails.country,
          'receivingFrom'
        ),
      this.transaction.destinationUserId &&
        this.transaction.destinationAmountDetails?.country &&
        this.aggregationRepository.addUserTransactionCountry(
          this.transaction.destinationUserId,
          this.transaction.destinationAmountDetails.country,
          'receivingTo'
        ),
    ])
  }

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }
}
