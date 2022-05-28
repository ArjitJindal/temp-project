import { Aggregator } from './aggregator'

export class UserTransactionCurrencies extends Aggregator {
  public shouldAggregate(): boolean {
    return this.transaction.transactionState === 'SUCCESSFUL'
  }

  public async aggregate(): Promise<void> {
    if (
      this.transaction.originUserId &&
      this.transaction.destinationAmountDetails?.transactionCurrency
    ) {
      await this.aggregationRepository.addUserTransactionCurrency(
        this.transaction.originUserId,
        this.transaction.destinationAmountDetails.transactionCurrency,
        'sending'
      )
    }
    if (
      this.transaction.destinationUserId &&
      this.transaction.originAmountDetails?.transactionCurrency
    ) {
      await this.aggregationRepository.addUserTransactionCurrency(
        this.transaction.destinationUserId,
        this.transaction.originAmountDetails.transactionCurrency,
        'receiving'
      )
    }
  }
}
