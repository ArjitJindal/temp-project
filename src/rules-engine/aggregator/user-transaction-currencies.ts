import { Aggregator } from './aggregator'

export class UserTransactionCurrencies extends Aggregator {
  public async aggregate(): Promise<void> {
    if (this.transaction.senderUserId) {
      await this.aggregationRepository.addUserTransactionCurrency(
        this.transaction.senderUserId,
        this.transaction.receivingAmountDetails.transactionCurrency,
        'sending'
      )
    }
    if (this.transaction.receiverUserId) {
      await this.aggregationRepository.addUserTransactionCurrency(
        this.transaction.receiverUserId,
        this.transaction.sendingAmountDetails.transactionCurrency,
        'receiving'
      )
    }
  }
}
