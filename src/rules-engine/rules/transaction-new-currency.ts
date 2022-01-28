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
      displayName: 'Transaction from/to a new currency ',
      description:
        'Transaction to or from a currency that has not been used before by this customer. Trigger the rule after x transactions have been completed',
    }
  }

  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { senderUserId, receiverUserId } = this.transaction
    const { transactionCurrency: senderCurrency } =
      this.transaction.sendingAmountDetails
    const { transactionCurrency: receiverCurrency } =
      this.transaction.receivingAmountDetails
    const [
      senderTransactionCurrencies,
      senderTransactionsCount,
      receiverTransactionCurrencies,
      receiverTransactionsCount,
    ] = await Promise.all([
      aggregationRepository.getUserTransactionCurrencies(senderUserId),
      aggregationRepository.getUserTransactionsCount(senderUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionCurrencies(receiverUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionsCount(receiverUserId),
    ])

    if (
      (senderTransactionsCount.sendingTransactionsCount >=
        this.parameters.initialTransactions &&
        !senderTransactionCurrencies.sendingCurrencies.has(receiverCurrency)) ||
      (receiverUserId &&
        receiverTransactionsCount &&
        receiverTransactionsCount.receivingTransactionsCount >=
          this.parameters.initialTransactions &&
        receiverTransactionCurrencies &&
        !receiverTransactionCurrencies.receivingCurrencies.has(senderCurrency))
    ) {
      return {
        action: this.parameters.action,
      }
    }
  }
}
