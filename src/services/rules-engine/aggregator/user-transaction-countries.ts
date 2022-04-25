import { Aggregator } from './aggregator'

export class UserTransactionCountries extends Aggregator {
  public async aggregate(): Promise<void> {
    if (
      this.transaction.originUserId &&
      this.transaction.destinationAmountDetails?.country
    ) {
      await this.aggregationRepository.addUserTransactionCountry(
        this.transaction.originUserId,
        this.transaction.destinationAmountDetails.country,
        'sending'
      )
    }
    if (
      this.transaction.destinationUserId &&
      this.transaction.originAmountDetails?.country
    ) {
      await this.aggregationRepository.addUserTransactionCountry(
        this.transaction.destinationUserId,
        this.transaction.originAmountDetails.country,
        'receiving'
      )
    }
  }
}
