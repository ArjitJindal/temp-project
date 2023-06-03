import { Aggregator } from './aggregator'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export class UserTransactionCurrencies extends Aggregator {
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

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }
}
