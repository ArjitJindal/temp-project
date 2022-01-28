import { Aggregator } from './aggregator'

export class UserLastTransactionsTime extends Aggregator {
  public async aggregate(): Promise<void> {
    await this.aggregationRepository.setUserLastTransactionTime(
      this.transaction.senderUserId,
      this.transaction.timestamp
    )
  }
}
