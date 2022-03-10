import { Transaction } from '../../../@types/openapi-public/transaction'
import { TransactionAmountDetails } from '../../../@types/openapi-public/transactionAmountDetails'
import { RuleParameters } from '../../../@types/rule/rule-instance'
import { PaymentDirection } from '../../../@types/tranasction/payment-direction'
import { TransactionRepository } from '../repositories/transaction-repository'
import { MissingRuleParameter } from './errors'
import { Rule } from './rule'

type LowValueTransactionsRuleParameters = RuleParameters & {
  lowTransactionValues: {
    [currency: string]: {
      max: number
      min: number
    }
  }
  lowTransactionCount: number
}

export default class LowValueTransactionsRule extends Rule<LowValueTransactionsRuleParameters> {
  private getTransactionUserId(): string | undefined {
    const direction = this.getDirection()
    switch (direction) {
      case 'sending':
        return this.transaction.senderUserId
      case 'receiving':
        return this.transaction.receiverUserId
    }
  }

  private getTransactionAmountDetails(
    transaction: Transaction
  ): TransactionAmountDetails | undefined {
    const direction = this.getDirection()
    switch (direction) {
      case 'sending':
        return transaction.sendingAmountDetails
      case 'receiving':
        return transaction.receivingAmountDetails
    }
  }
  protected getDirection(): PaymentDirection {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const transactionRepository = new TransactionRepository(
      this.tenantId,
      this.dynamoDb
    )
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
      const areAllTransactionsLowValue = transactions.every((transaction) => {
        const transactionAmountDetails =
          this.getTransactionAmountDetails(transaction)
        if (!transactionAmountDetails) {
          return false
        }
        const { transactionCurrency, transactionAmount } =
          transactionAmountDetails

        const thresholdValue =
          this.parameters.lowTransactionValues[transactionCurrency]
        if (thresholdValue === undefined) {
          throw new MissingRuleParameter(
            `Rule parameter lowTransactionValues doesn't include currency ${transactionCurrency}`
          )
        }
        return (
          transactionAmount > thresholdValue.min &&
          transactionAmount < thresholdValue.max
        )
      })
      if (areAllTransactionsLowValue) {
        return { action: this.parameters.action }
      }
    }
  }
}
