import { JSONSchemaType } from 'ajv'
import { INITIAL_TRANSACTIONS_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type TransactionNewCountryRuleParameters = {
  initialTransactions: number
}

@traceable
export default class TransactionNewCountryRule extends TransactionRule<TransactionNewCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionNewCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: INITIAL_TRANSACTIONS_SCHEMA(),
      },

      required: ['initialTransactions'],
    }
  }

  public async computeHits(): Promise<{
    hitReceiver: boolean
    hitSender: boolean
  }> {
    const senderCountry = this.transaction.originAmountDetails?.country
    const receiverCountry = this.transaction.destinationAmountDetails?.country
    const {
      senderTransactionCountries,
      senderTransactionsCount,
      receiverTransactionCountries,
      receiverTransactionsCount,
    } = await this.getData()

    const hitSender =
      receiverCountry &&
      senderTransactionsCount &&
      senderTransactionsCount >= this.parameters.initialTransactions &&
      senderTransactionCountries &&
      !senderTransactionCountries.has(receiverCountry)
    const hitReceiver =
      senderCountry &&
      receiverTransactionsCount &&
      receiverTransactionsCount >= this.parameters.initialTransactions &&
      receiverTransactionCountries &&
      !receiverTransactionCountries.has(senderCountry)
    return { hitSender: !!hitSender, hitReceiver: !!hitReceiver }
  }

  public async computeRule() {
    const { hitReceiver, hitSender } = await this.computeHits()

    const hitResult: RuleHitResult = []
    if (hitSender) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
    }
    if (hitReceiver) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: super.getTransactionVars('destination'),
      })
    }
    return {
      ruleHitResult: hitResult,
    }
  }

  private async getData(): Promise<{
    senderTransactionCountries: Set<string>
    senderTransactionsCount: number
    receiverTransactionCountries: Set<string>
    receiverTransactionsCount: number
  }> {
    const { originUserId, destinationUserId } = this.transaction
    if (this.aggregationRepository) {
      const [
        senderTransactionCountries,
        senderTransactionsCount,
        receiverTransactionCountries,
        receiverTransactionsCount,
      ] = await Promise.all([
        originUserId
          ? this.aggregationRepository.getUserTransactionCountries(originUserId)
          : undefined,
        originUserId
          ? this.aggregationRepository.getUserTransactionsCount(originUserId)
          : undefined,
        destinationUserId
          ? this.aggregationRepository.getUserTransactionCountries(
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
        senderTransactionCountries:
          senderTransactionCountries?.sendingToCountries || new Set(),
        senderTransactionsCount:
          senderTransactionsCount?.sendingTransactionsCount || 0,
        receiverTransactionCountries:
          receiverTransactionCountries?.receivingFromCountries || new Set(),
        receiverTransactionsCount:
          receiverTransactionsCount?.receivingTransactionsCount || 0,
      }
    }
    const transactionRepository = this
      .transactionRepository as MongoDbTransactionRepository
    const [
      senderTransactionsCount,
      receiverTransactionsCount,
      senderTransactionCountries,
      receiverTransactionCountries,
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
              field: 'COUNTRY',
              direction: 'destination',
            },
            [{ originUserId }, { transactionState: 'SUCCESSFUL' }]
          )
        : [],
      destinationUserId
        ? await transactionRepository.getUniques(
            {
              field: 'COUNTRY',
              direction: 'origin',
            },
            [{ destinationUserId }, { transactionState: 'SUCCESSFUL' }]
          )
        : [],
    ])
    return {
      senderTransactionCountries: new Set(senderTransactionCountries),
      senderTransactionsCount: senderTransactionsCount,
      receiverTransactionCountries: new Set(receiverTransactionCountries),
      receiverTransactionsCount: receiverTransactionsCount,
    }
  }
}
