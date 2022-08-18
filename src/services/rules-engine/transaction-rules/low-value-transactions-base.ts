import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { everyAsync } from '@/core/utils/array'

type LowValueTransactionsRuleParameters = DefaultTransactionRuleParameters & {
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
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        lowTransactionValues: {
          type: 'object',
          title: 'Low Transaction Value',
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
        lowTransactionCount: {
          type: 'integer',
          title: 'Low-value Transactions Count Threshold',
        },
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
    const { lowTransactionValues, transactionState } = this.parameters
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
              lastNTransactionsToCheck,
              { transactionState }
            )
          : transactionRepository.getLastNUserSendingThinTransactions(
              userId,
              lastNTransactionsToCheck,
              { transactionState }
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
        return { action: this.action }
      }
    }
  }
}
