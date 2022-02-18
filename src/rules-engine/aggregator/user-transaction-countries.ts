import { Aggregator } from './aggregator'

export class UserTransactionCountries extends Aggregator {
  public async aggregate(): Promise<void> {
    if (
      this.transaction.senderUserId &&
      this.transaction.receivingAmountDetails?.country
    ) {
      await this.aggregationRepository.addUserTransactionCountry(
        this.transaction.senderUserId,
        this.transaction.receivingAmountDetails.country,
        'sending'
      )
    }
    if (
      this.transaction.receiverUserId &&
      this.transaction.sendingAmountDetails?.country
    ) {
      await this.aggregationRepository.addUserTransactionCountry(
        this.transaction.receiverUserId,
        this.transaction.sendingAmountDetails.country,
        'receiving'
      )
    }
  }
}
