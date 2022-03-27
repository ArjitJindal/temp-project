import { RuleParameters } from '../../../@types/rule/rule-instance'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule } from './rule'

type TransactionNewCurrencyRuleParameters = RuleParameters & {
  initialTransactions: number
}

export default class TransactionNewCurrencyRule extends Rule<TransactionNewCurrencyRuleParameters> {
  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { senderUserId, receiverUserId } = this.transaction
    const senderCurrency =
      this.transaction.sendingAmountDetails?.transactionCurrency
    const receiverCurrency =
      this.transaction.sendingAmountDetails?.transactionCurrency
    const [
      senderTransactionCurrencies,
      senderTransactionsCount,
      receiverTransactionCurrencies,
      receiverTransactionsCount,
    ] = await Promise.all([
      senderUserId &&
        aggregationRepository.getUserTransactionCurrencies(senderUserId),
      senderUserId &&
        aggregationRepository.getUserTransactionsCount(senderUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionCurrencies(receiverUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionsCount(receiverUserId),
    ])

    if (
      (senderTransactionsCount &&
        senderTransactionsCount.sendingTransactionsCount >=
          this.parameters.initialTransactions &&
        senderTransactionCurrencies &&
        receiverCurrency &&
        !senderTransactionCurrencies.sendingCurrencies.has(receiverCurrency)) ||
      (receiverUserId &&
        receiverTransactionsCount &&
        receiverTransactionsCount.receivingTransactionsCount >=
          this.parameters.initialTransactions &&
        receiverTransactionCurrencies &&
        senderCurrency &&
        !receiverTransactionCurrencies.receivingCurrencies.has(senderCurrency))
    ) {
      return {
        action: this.parameters.action,
      }
    }
  }
}
