import { JSONSchemaType } from 'ajv'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { TransactionRule } from './rule'

export type TransactionNewCurrencyRuleParameters = {
  initialTransactions: number
}

export default class TransactionNewCurrencyRule extends TransactionRule<TransactionNewCurrencyRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionNewCurrencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: {
          type: 'integer',
          title: 'Initial Transactions Count Threshold',
        },
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
    const senderCurrency =
      this.transaction.originAmountDetails?.transactionCurrency
    const receiverCurrency =
      this.transaction.destinationAmountDetails?.transactionCurrency
    const [
      senderTransactionCurrencies,
      senderTransactionsCount,
      receiverTransactionCurrencies,
      receiverTransactionsCount,
    ] = await Promise.all([
      originUserId &&
        aggregationRepository.getUserTransactionCurrencies(originUserId),
      originUserId &&
        aggregationRepository.getUserTransactionsCount(originUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionCurrencies(destinationUserId),
      destinationUserId &&
        aggregationRepository.getUserTransactionsCount(destinationUserId),
    ])

    if (
      (senderTransactionsCount &&
        senderTransactionsCount.sendingTransactionsCount >=
          this.parameters.initialTransactions &&
        senderTransactionCurrencies &&
        receiverCurrency &&
        !senderTransactionCurrencies.sendingCurrencies.has(receiverCurrency)) ||
      (destinationUserId &&
        receiverTransactionsCount &&
        receiverTransactionsCount.receivingTransactionsCount >=
          this.parameters.initialTransactions &&
        receiverTransactionCurrencies &&
        senderCurrency &&
        !receiverTransactionCurrencies.receivingCurrencies.has(senderCurrency))
    ) {
      return {
        action: this.action,
      }
    }
  }
}
