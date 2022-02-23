import { RuleParameters } from '../../../@types/rule/rule-instance'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule, RuleInfo } from './rule'

type TransactionNewCountryRuleParameters = RuleParameters & {
  initialTransactions: number
}

export default class TransactionNewCountryRule extends Rule<TransactionNewCountryRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'transaction_new_country',
      displayName:
        'Transaction to or from a country that has not been used before by this customer. Trigger the rule after x transactions have been completed',
      description:
        'Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.',
    }
  }

  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { senderUserId, receiverUserId } = this.transaction
    const senderCountry = this.transaction.sendingAmountDetails?.country
    const receiverCountry = this.transaction.receivingAmountDetails?.country
    const [
      senderTransactionCountries,
      senderTransactionsCount,
      receiverTransactionCountries,
      receiverTransactionsCount,
    ] = await Promise.all([
      senderUserId &&
        aggregationRepository.getUserTransactionCountries(senderUserId),
      senderUserId &&
        aggregationRepository.getUserTransactionsCount(senderUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionCountries(receiverUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionsCount(receiverUserId),
    ])

    if (
      (receiverCountry &&
        senderTransactionsCount &&
        senderTransactionsCount?.sendingTransactionsCount &&
        senderTransactionsCount.sendingTransactionsCount >=
          this.parameters.initialTransactions &&
        senderTransactionCountries &&
        !senderTransactionCountries.sendingCountries.has(receiverCountry)) ||
      (senderCountry &&
        receiverTransactionsCount &&
        receiverTransactionsCount.receivingTransactionsCount >=
          this.parameters.initialTransactions &&
        receiverTransactionCountries &&
        !receiverTransactionCountries.receivingCountries.has(senderCountry))
    ) {
      return {
        action: this.parameters.action,
      }
    }
  }
}
