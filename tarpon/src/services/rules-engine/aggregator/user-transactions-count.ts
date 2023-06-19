import { Aggregator } from './aggregator'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export class UserTransactionsCount extends Aggregator {
  public async aggregate(transaction: Transaction): Promise<void> {
    if (transaction.originUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        transaction.originUserId,
        'sending'
      )
    }
    if (transaction.destinationUserId) {
      await this.aggregationRepository.addUserTransactionsCount(
        transaction.destinationUserId,
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
