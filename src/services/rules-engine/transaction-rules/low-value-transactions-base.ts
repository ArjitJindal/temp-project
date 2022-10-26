import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import {
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_RANGE_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { everyAsync } from '@/core/utils/array'

export type LowValueTransactionsRuleParameters =
  DefaultTransactionRuleParameters & {
    lowTransactionValues: {
      [currency: string]: {
        max: number
        min: number
      }
    }
    lowTransactionCount: number
  }

export default class LowValueTransactionsRule extends TransactionRule<LowValueTransactionsRuleParameters> {
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
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
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
    const { lowTransactionCount, lowTransactionValues, transactionState } =
      this.parameters
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
              { transactionState },
              ['originAmountDetails', 'destinationAmountDetails']
            )
          : transactionRepository.getLastNUserSendingTransactions(
              userId,
              lastNTransactionsToCheck,
              { transactionState },
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
      if (areAllTransactionsLowValue) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars(
              this.getDirection() === 'sending' ? 'origin' : 'destination'
            ),
            transactionCountDelta:
              lowTransactionCount - transactions.length + 1,
          },
        }
      }
    }
  }
}
