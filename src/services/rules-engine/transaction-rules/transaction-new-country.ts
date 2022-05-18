import { JSONSchemaType } from 'ajv'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { TransactionRule } from './rule'

export type TransactionNewCountryRuleParameters = {
  initialTransactions: number
}

export default class TransactionNewCountryRule extends TransactionRule<TransactionNewCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionNewCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: { type: 'integer' },
      },
      required: ['initialTransactions'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { originUserId, destinationUserId } = this.transaction
    const senderCountry = this.transaction.originAmountDetails?.country
    const receiverCountry = this.transaction.destinationAmountDetails?.country
    const [
      senderTransactionCountries,
      senderTransactionsCount,
      receiverTransactionCountries,
      receiverTransactionsCount,
    ] = await Promise.all([
      originUserId &&
        aggregationRepository.getUserTransactionCountries(originUserId),
      originUserId &&
        aggregationRepository.getUserTransactionsCount(originUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionCountries(destinationUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionsCount(destinationUserId),
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
