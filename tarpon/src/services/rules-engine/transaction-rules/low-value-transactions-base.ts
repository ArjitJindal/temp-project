import { JSONSchemaType } from 'ajv'
import { uniqBy } from 'lodash'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import {
  TRANSACTION_AMOUNT_RANGE_SCHEMA,
  TransactionAmountRange,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { everyAsync } from '@/core/utils/array'
import { traceable } from '@/core/xray'

export type LowValueTransactionsRuleParameters = {
  lowTransactionValues: TransactionAmountRange
  lowTransactionCount: number
}

@traceable
export default abstract class LowValueTransactionsRule extends TransactionRule<
  LowValueTransactionsRuleParameters,
  TransactionHistoricalFilters
> {
  public static getSchema(): JSONSchemaType<LowValueTransactionsRuleParameters> {
    return {
      type: 'object',
      properties: {
        lowTransactionValues: TRANSACTION_AMOUNT_RANGE_SCHEMA({
          title: 'Low transaction value',
        }),
        lowTransactionCount: {
          type: 'integer',
          title: 'Low-value transactions count threshold',
          description:
            'rule is run when the transactions count is greater or equal to threshold',
        },
      },
      required: ['lowTransactionValues', 'lowTransactionCount'],
    }
  }

  private getTransactionUserId(): string | undefined {
    const direction = this.getDirection()
    switch (direction) {
      case 'sending':
        return this.transaction.originUserId
      case 'receiving':
        return this.transaction.destinationUserId
    }
  }

  private getTransactionAmountDetails(
    transaction: Transaction
  ): TransactionAmountDetails | undefined {
    const direction = this.getDirection()
    switch (direction) {
      case 'sending':
        return transaction.originAmountDetails
      case 'receiving':
        return transaction.destinationAmountDetails
    }
  }
  protected abstract getDirection(): PaymentDirection

  public async computeRule() {
    const { lowTransactionCount, lowTransactionValues } = this.parameters

    const userId = this.getTransactionUserId()
    if (userId) {
      const lastNTransactionsToCheck = lowTransactionCount - 1
      const transactions = uniqBy(
        (
          (await (this.getDirection() === 'receiving'
            ? this.transactionRepository.getLastNUserReceivingTransactions(
                userId,
                lastNTransactionsToCheck,
                {
                  transactionStates: this.filters.transactionStatesHistorical,
                  transactionTypes: this.filters.transactionTypesHistorical,
                  transactionAmountRange:
                    this.filters.transactionAmountRangeHistorical,
                  destinationPaymentMethods:
                    this.filters.paymentMethodsHistorical,
                  destinationCountries:
                    this.filters.transactionCountriesHistorical,
                },
                [
                  'transactionId',
                  'originAmountDetails',
                  'destinationAmountDetails',
                ]
              )
            : this.transactionRepository.getLastNUserSendingTransactions(
                userId,
                lastNTransactionsToCheck,
                {
                  transactionStates: this.filters.transactionStatesHistorical,
                  transactionTypes: this.filters.transactionTypesHistorical,
                  transactionAmountRange:
                    this.filters.transactionAmountRangeHistorical,
                  originPaymentMethods: this.filters.paymentMethodsHistorical,
                  originCountries: this.filters.transactionCountriesHistorical,
                },
                [
                  'transactionId',
                  'originAmountDetails',
                  'destinationAmountDetails',
                ]
              ))) as Transaction[]
        ).concat(this.transaction),
        'transactionId'
      )
      if (transactions.length <= lastNTransactionsToCheck) {
        return undefined
      }

      const areAllTransactionsLowValue = await everyAsync(
        transactions,
        async (transaction) => {
          const transactionAmountDetails =
            this.getTransactionAmountDetails(transaction)
          if (!transactionAmountDetails) {
            return false
          }
          return (
            (await checkTransactionAmountBetweenThreshold(
              transactionAmountDetails,
              lowTransactionValues
            )) != null
          )
        }
      )

      const hitResult: RuleHitResult = []
      if (areAllTransactionsLowValue) {
        hitResult.push({
          direction:
            this.getDirection() === 'sending' ? 'ORIGIN' : 'DESTINATION',
          vars: {
            ...super.getTransactionVars(
              this.getDirection() === 'sending' ? 'origin' : 'destination'
            ),
            transactionCountDelta:
              lowTransactionCount - transactions.length + 1,
          },
        })
      }
      return hitResult
    }
  }
}
