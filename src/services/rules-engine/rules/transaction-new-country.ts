import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule } from './rule'

type TransactionNewCountryRuleParameters = {
  initialTransactions: number
}

export default class TransactionNewCountryRule extends Rule<TransactionNewCountryRuleParameters> {
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
        action: this.action,
      }
    }
  }
}
