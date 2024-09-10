import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { INITIAL_TRANSACTIONS_SCHEMA } from '../utils/rule-parameter-schemas'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type TransactionNewCurrencyRuleParameters = {
  initialTransactions: number
}

@traceable
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
    const senderCurrency =
      this.transaction.originAmountDetails?.transactionCurrency
    const receiverCurrency =
      this.transaction.destinationAmountDetails?.transactionCurrency
    const {
      senderTransactionCurrencies,
      senderTransactionsCount,
      receiverTransactionCurrencies,
      receiverTransactionsCount,
    } = await this.getData()

    const isSenderHit =
      receiverCurrency &&
      senderTransactionsCount &&
      senderTransactionsCount >= this.parameters.initialTransactions &&
      senderTransactionCurrencies &&
      !senderTransactionCurrencies.has(receiverCurrency)

    const isDestinationHit =
      senderCurrency &&
      receiverTransactionsCount &&
      receiverTransactionsCount >= this.parameters.initialTransactions &&
      receiverTransactionCurrencies &&
      !receiverTransactionCurrencies.has(senderCurrency)

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

  private async getData(): Promise<{
    senderTransactionCurrencies: Set<string>
    senderTransactionsCount: number
    receiverTransactionCurrencies: Set<string>
    receiverTransactionsCount: number
  }> {
    const { originUserId, destinationUserId } = this.transaction
    if (this.aggregationRepository) {
      const [
        senderTransactionCurrencies,
        senderTransactionsCount,
        receiverTransactionCurrencies,
        receiverTransactionsCount,
      ] = await Promise.all([
        originUserId
          ? this.aggregationRepository.getUserTransactionCurrencies(
              originUserId
            )
          : undefined,
        originUserId
          ? this.aggregationRepository.getUserTransactionsCount(originUserId)
          : undefined,
        destinationUserId
          ? this.aggregationRepository.getUserTransactionCurrencies(
              destinationUserId
            )
          : undefined,
        destinationUserId
          ? this.aggregationRepository.getUserTransactionsCount(
              destinationUserId
            )
          : undefined,
      ])
      return {
        senderTransactionCurrencies:
          senderTransactionCurrencies?.sendingCurrencies || new Set(),
        senderTransactionsCount:
          senderTransactionsCount?.sendingTransactionsCount || 0,
        receiverTransactionCurrencies:
          receiverTransactionCurrencies?.receivingCurrencies || new Set(),
        receiverTransactionsCount:
          receiverTransactionsCount?.receivingTransactionsCount || 0,
      }
    }

    const transactionRepository = this
      .transactionRepository as MongoDbTransactionRepository
    const [
      senderTransactionsCount,
      receiverTransactionsCount,
      senderTransactionCurrencies,
      receiverTransactionCurrencies,
    ] = await Promise.all([
      originUserId
        ? await transactionRepository.getTransactionsCount({
            filterOriginUserId: originUserId,
          })
        : 0,
      destinationUserId
        ? await transactionRepository.getTransactionsCount({
            filterDestinationUserId: destinationUserId,
          })
        : 0,
      originUserId
        ? await transactionRepository.getUniques(
            {
              field: 'CURRENCY',
              direction: 'destination',
            },
            [{ originUserId }, { transactionState: 'SUCCESSFUL' }]
          )
        : [],
      destinationUserId
        ? await transactionRepository.getUniques(
            {
              field: 'CURRENCY',
              direction: 'origin',
            },
            [{ destinationUserId }, { transactionState: 'SUCCESSFUL' }]
          )
        : [],
    ])
    return {
      senderTransactionCurrencies: new Set(senderTransactionCurrencies),
      senderTransactionsCount: senderTransactionsCount,
      receiverTransactionCurrencies: new Set(receiverTransactionCurrencies),
      receiverTransactionsCount: receiverTransactionsCount,
    }
  }
}
