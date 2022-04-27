import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'

type LowValueTransactionsRuleParameters = {
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
        lowTransactionValues: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              max: { type: 'integer' },
              min: { type: 'integer' },
            },
            required: ['max', 'min'],
          },
          required: [],
        },
        lowTransactionCount: { type: 'integer' },
      },
      required: ['lowTransactionValues', 'lowTransactionCount'],
      additionalProperties: false,
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
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const userId = this.getTransactionUserId()
    if (userId) {
      const lastNTransactionsToCheck = this.parameters.lowTransactionCount - 1
      const thinTransactionIds = (
        await (this.getDirection() === 'receiving'
          ? transactionRepository.getLastNUserReceivingThinTransactions(
              userId,
              lastNTransactionsToCheck
            )
          : transactionRepository.getLastNUserSendingThinTransactions(
              userId,
              lastNTransactionsToCheck
            ))
      ).map((transaction) => transaction.transactionId)
      if (thinTransactionIds.length < lastNTransactionsToCheck) {
        return undefined
      }

      const transactions = [
        ...(await transactionRepository.getTransactionsByIds(
          thinTransactionIds
        )),
        this.transaction,
      ]
      const areAllTransactionsLowValue = transactions.every(
        async (transaction) => {
          const transactionAmountDetails =
            this.getTransactionAmountDetails(transaction)
          if (!transactionAmountDetails) {
            return false
          }
          return await isTransactionAmountBetweenThreshold(
            transactionAmountDetails,
            this.parameters.lowTransactionValues
          )
        }
      )
      if (areAllTransactionsLowValue) {
        return { action: this.action }
      }
    }
  }
}
