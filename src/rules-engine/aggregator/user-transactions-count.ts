import { Aggregator } from './aggregator'

export class UserTransactionsCount extends Aggregator {
  public async aggregate(): Promise<void> {
    if (this.transaction.senderUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        this.transaction.senderUserId,
        'sending'
      )
    }
    if (this.transaction.receiverUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        this.transaction.receiverUserId,
        'receiving'
      )
    }
  }
}
