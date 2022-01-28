import { RuleParameters } from '../../@types/rule/rule-instance'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule, RuleInfo } from './rule'

type TransactionNewCountryRuleParameters = RuleParameters & {
  initialTransactions: number
}

export default class TransactionNewCountryRule extends Rule<TransactionNewCountryRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'transaction_new_country',
      displayName: 'Transaction from/to a new country ',
      description:
        'Transaction to or from a country that has not been used before by this customer. Trigger the rule after x transactions have been completed',
    }
  }

  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { senderUserId, receiverUserId } = this.transaction
    const { country: senderCountry } = this.transaction.sendingAmountDetails
    const { country: receiverCountry } = this.transaction.receivingAmountDetails
    const [
      senderTransactionCountries,
      senderTransactionsCount,
      receiverTransactionCountries,
      receiverTransactionsCount,
    ] = await Promise.all([
      aggregationRepository.getUserTransactionCountries(senderUserId),
      aggregationRepository.getUserTransactionsCount(senderUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionCountries(receiverUserId),
      receiverUserId &&
        aggregationRepository.getUserTransactionsCount(receiverUserId),
    ])

    if (
      (receiverCountry &&
        senderTransactionsCount.sendingTransactionsCount >=
          this.parameters.initialTransactions &&
        !senderTransactionCountries.sendingCountries.has(receiverCountry)) ||
      (senderCountry &&
        receiverUserId &&
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
