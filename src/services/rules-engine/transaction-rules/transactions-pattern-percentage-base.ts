import { JSONSchemaType } from 'ajv'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { getTransactionUserPastTransactions } from '../utils/transaction-rule-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  INITIAL_TRANSACTIONS_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type TransactionsPatternPercentageRuleParameters = {
  patternPercentageLimit: number
  timeWindow: TimeWindow
  initialTransactions: number

  // Optional parameters
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
}

export default class TransactionsPatternPercentageBaseRule<
  T extends TransactionsPatternPercentageRuleParameters
> extends TransactionRule<T, TransactionFilters> {
  transactionRepository?: TransactionRepository

  public static getBaseSchema(): JSONSchemaType<TransactionsPatternPercentageRuleParameters> {
    return {
      type: 'object',
      properties: {
        patternPercentageLimit: {
          type: 'number',
          title: 'Threshold percentage limit',
          minimum: 0,
          maximum: 100,
        },
        initialTransactions: INITIAL_TRANSACTIONS_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['initialTransactions', 'patternPercentageLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    const originMatchPattern = this.matchPattern(this.transaction, 'origin')
    const destinationMatchPattern = this.matchPattern(
      this.transaction,
      'destination'
    )
    if (!originMatchPattern && !destinationMatchPattern) {
      return
    }

    const {
      timeWindow,
      patternPercentageLimit,
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
      },
      this.getNeededTransactionFields()
    )

    if (originMatchPattern) {
      const senderTransactions = senderSendingTransactions
        .concat(senderReceivingTransactions)
        .concat(this.transaction)
      const senderMatchedTransactions = [
        ...senderSendingTransactions
          .concat(this.transaction)
          .filter((transaction) => this.matchPattern(transaction, 'origin')),
        ...senderReceivingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'destination')
        ),
      ]
      const senderMatchPercentage =
        (senderMatchedTransactions.length / senderTransactions.length) * 100

      if (
        senderTransactions.length > initialTransactions &&
        senderMatchPercentage > patternPercentageLimit
      ) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars('origin'),
          },
        }
      }
    }

    if (destinationMatchPattern) {
      const receiverTransactions = receiverSendingTransactions
        .concat(receiverReceivingTransactions)
        .concat(this.transaction)
      const receiverMatchedTransactions = [
        ...receiverSendingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'origin')
        ),
        ...receiverReceivingTransactions
          .concat(this.transaction)
          .filter((transaction) =>
            this.matchPattern(transaction, 'destination')
          ),
      ]
      const receiverMatchPercentage =
        (receiverMatchedTransactions.length / receiverTransactions.length) * 100

      if (
        destinationMatchPattern &&
        receiverTransactions.length > initialTransactions &&
        receiverMatchPercentage > patternPercentageLimit
      ) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars('destination'),
          },
        }
      }
    }
  }

  protected matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination'
  ): boolean {
    throw new Error('Not implemented')
  }

  protected getNeededTransactionFields(): Array<keyof Transaction> {
    throw new Error('Not implemented')
  }
}
