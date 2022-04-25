import { Aggregator } from './aggregator'

export class UserTransactionsCount extends Aggregator {
  public async aggregate(): Promise<void> {
    if (this.transaction.originUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        this.transaction.originUserId,
        'sending'
      )
    }
    if (this.transaction.destinationUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        this.transaction.destinationUserId,
        'receiving'
      )
    }
  }
}
