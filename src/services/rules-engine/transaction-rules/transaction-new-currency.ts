import { JSONSchemaType } from 'ajv'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { RuleHitResult } from '../rule'
import { INITIAL_TRANSACTIONS_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'

export type TransactionNewCurrencyRuleParameters = {
  initialTransactions: number
}

export default class TransactionNewCurrencyRule extends TransactionRule<TransactionNewCurrencyRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionNewCurrencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: INITIAL_TRANSACTIONS_SCHEMA(),
      },
      required: ['initialTransactions'],
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

    const isSenderHit =
      senderTransactionsCount &&
      senderTransactionsCount.sendingTransactionsCount >=
        this.parameters.initialTransactions &&
      senderTransactionCurrencies &&
      receiverCurrency &&
      !senderTransactionCurrencies.sendingCurrencies.has(receiverCurrency)
    const isDestinationHit =
      destinationUserId &&
      receiverTransactionsCount &&
      receiverTransactionsCount.receivingTransactionsCount >=
        this.parameters.initialTransactions &&
      receiverTransactionCurrencies &&
      senderCurrency &&
      !receiverTransactionCurrencies.receivingCurrencies.has(senderCurrency)

    const hitResult: RuleHitResult = []
    if (isSenderHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
    }
    if (isDestinationHit) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: super.getTransactionVars('destination'),
      })
    }
    return hitResult
  }
}
