import { RuleParameters } from '../../@types/rule/rule-instance'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule, RuleInfo } from './rule'

type TransactionNewCurrencyRuleParameters = RuleParameters & {
  initialTransactions: number
}

export default class TransactionNewCurrencyRule extends Rule<TransactionNewCurrencyRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'transaction_new_currency',
      displayName:
        'Transaction to or from a currency that has not been used before by this customer. Trigger the rule after x transactions have been completed',
      description:
        'Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.',
    }
  }

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
