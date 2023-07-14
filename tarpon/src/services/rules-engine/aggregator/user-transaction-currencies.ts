import { Aggregator } from './aggregator'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export class UserTransactionCurrencies extends Aggregator {
  public static aggregatorName = 'UserTransactionCurrencies'
  public async aggregate(transaction: Transaction): Promise<void> {
    if (
      transaction.originUserId &&
      transaction.destinationAmountDetails?.transactionCurrency
    ) {
      await this.aggregationRepository.addUserTransactionCurrency(
        transaction.originUserId,
        transaction.destinationAmountDetails.transactionCurrency,
        'sending'
      )
    }
    if (
      transaction.destinationUserId &&
      transaction.originAmountDetails?.transactionCurrency
    ) {
      await this.aggregationRepository.addUserTransactionCurrency(
        transaction.destinationUserId,
        transaction.originAmountDetails.transactionCurrency,
        'receiving'
      )
    }
  }

  public getTargetTransactionState(): TransactionState {
    return 'SUCCESSFUL'
  }

  public async rebuildAggregation(_userId: string): Promise<void> {
    // TODO: Implement me
  }
}
