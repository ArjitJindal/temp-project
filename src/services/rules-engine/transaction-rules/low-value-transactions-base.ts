import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import {
  TRANSACTION_AMOUNT_RANGE_SCHEMA,
  PAYMENT_CHANNEL_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { everyAsync } from '@/core/utils/array'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
export type LowValueTransactionsRuleParameters = {
  lowTransactionValues: {
    [currency: string]: {
      max: number
      min: number
    }
  }
  lowTransactionCount: number
  paymentChannel?: string
}

export default class LowValueTransactionsRule extends TransactionRule<
  LowValueTransactionsRuleParameters,
  TransactionFilters
> {
  public static getSchema(): JSONSchemaType<LowValueTransactionsRuleParameters> {
    return {
      type: 'object',
      properties: {
        lowTransactionValues: TRANSACTION_AMOUNT_RANGE_SCHEMA({
          title: 'Low Transaction Value',
        }),
        lowTransactionCount: {
          type: 'integer',
          title: 'Low-value Transactions Count Threshold',
        },
        paymentChannel: PAYMENT_CHANNEL_OPTIONAL_SCHEMA(),
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
  protected getDirection(): PaymentDirection {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { lowTransactionCount, lowTransactionValues, paymentChannel } =
      this.parameters
    if (
      paymentChannel &&
      (this.transaction.originPaymentDetails as CardDetails).paymentChannel !==
        paymentChannel
    ) {
      return
    }
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const userId = this.getTransactionUserId()
    if (userId) {
      const lastNTransactionsToCheck = lowTransactionCount - 1
      const transactions = (
        (await (this.getDirection() === 'receiving'
          ? transactionRepository.getLastNUserReceivingTransactions(
              userId,
              lastNTransactionsToCheck,
              {
                transactionState: this.filters.transactionState,
                transactionTypes: this.filters.transactionTypes,
                destinationPaymentMethod: this.filters.paymentMethod,
                destinationCountries: this.filters.transactionCountries,
              },
              ['originAmountDetails', 'destinationAmountDetails']
            )
          : transactionRepository.getLastNUserSendingTransactions(
              userId,
              lastNTransactionsToCheck,
              {
                transactionState: this.filters.transactionState,
                transactionTypes: this.filters.transactionTypes,
                originPaymentMethod: this.filters.paymentMethod,
                originCountries: this.filters.transactionCountries,
              },
              ['originAmountDetails', 'destinationAmountDetails']
            ))) as Transaction[]
      ).concat(this.transaction)
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
