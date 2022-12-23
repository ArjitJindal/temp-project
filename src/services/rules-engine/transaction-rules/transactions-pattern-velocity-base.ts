import { JSONSchemaType } from 'ajv'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { getTransactionUserPastTransactions } from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type TransactionsPatternVelocityRuleParameters = {
  transactionsLimit: number
  timeWindow: TimeWindow

  // Optional parameters
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
  initialTransactions?: number
}

export default abstract class TransactionsPatternVelocityBaseRule<
  T extends TransactionsPatternVelocityRuleParameters
> extends TransactionRule<T, TransactionFilters> {
  transactionRepository?: TransactionRepository

  public static getBaseSchema(): JSONSchemaType<TransactionsPatternVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['transactionsLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    const originMatchPattern = this.matchPattern(
      this.transaction,
      'origin',
      'sender',
      true
    )
    const destinationMatchPattern = this.matchPattern(
      this.transaction,
      'destination',
      'receiver',
      true
    )
    if (!originMatchPattern && !destinationMatchPattern) {
      return
    }

    const {
      timeWindow,
      transactionsLimit,
      initialTransactions,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow,
        checkSender: originMatchPattern ? checkSender : 'none',
        checkReceiver: destinationMatchPattern ? checkReceiver : 'none',
        transactionState: this.filters.transactionState,
        transactionTypes: this.filters.transactionTypes,
        paymentMethod: this.filters.paymentMethod,
        countries: this.filters.transactionCountries,
      },
      this.getNeededTransactionFields()
    )

    const hitResult: RuleHitResult = []
    if (originMatchPattern) {
      const senderMatchedTransactions = [
        ...senderSendingTransactions
          .concat(this.transaction)
          .filter((transaction) =>
            this.matchPattern(transaction, 'origin', 'sender')
          ),
        ...senderReceivingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'destination', 'sender')
        ),
      ]
      const senderMatchedTransactionGroups = this.groupTransactions(
        senderMatchedTransactions
      )

      for (const group of senderMatchedTransactionGroups) {
        if (
          (!initialTransactions || group.length > initialTransactions!) &&
          group.length > transactionsLimit
        ) {
          hitResult.push({
            direction: 'ORIGIN',
            vars: super.getTransactionVars('origin'),
          })
          break
        }
      }
    }

    if (destinationMatchPattern) {
      const receiverMatchedTransactions = [
        ...receiverSendingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'origin', 'receiver')
        ),
        ...receiverReceivingTransactions
          .concat(this.transaction)
          .filter((transaction) =>
            this.matchPattern(transaction, 'destination', 'receiver')
          ),
      ]
      const receiverMatchedTransactionGroups = this.groupTransactions(
        receiverMatchedTransactions
      )

      for (const group of receiverMatchedTransactionGroups) {
        if (
          (!initialTransactions || group.length > initialTransactions!) &&
          group.length > transactionsLimit
        ) {
          hitResult.push({
            direction: 'DESTINATION',
            vars: super.getTransactionVars('destination'),
          })
          break
        }
      }
    }
    return hitResult
  }
  protected groupTransactions(
    transactions: AuxiliaryIndexTransaction[]
  ): AuxiliaryIndexTransaction[][] {
    return [transactions]
  }

  protected abstract matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination',
    _userType?: 'sender' | 'receiver',
    _pure?: boolean
  ): boolean

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>
}
