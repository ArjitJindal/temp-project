import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserType } from '../utils/user-rule-utils'
import {
  getTransactionUserPastTransactions,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

export type TransactionsPatternVelocityRuleParameters =
  DefaultTransactionRuleParameters & {
    transactionsLimit: number
    timeWindow: TimeWindow

    // Optional parameters
    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'
    initialTransactions?: number
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    userType?: UserType
  }

export default class TransactionsPatternVelocityBaseRule<
  T extends TransactionsPatternVelocityRuleParameters
> extends TransactionRule<T> {
  transactionRepository?: TransactionRepository

  public static getBaseSchema(): JSONSchemaType<TransactionsPatternVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['transactionsLimit', 'timeWindow'],
    }
  }

  public getFilters() {
    const { transactionTypes, paymentMethod, userType } = this.parameters
    return super
      .getFilters()
      .concat([
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
        () =>
          !paymentMethod ||
          this.transaction.originPaymentDetails?.method === paymentMethod,
        () => isUserType(this.senderUser, userType),
      ])
  }

  public async computeRule() {
    const {
      timeWindow,
      transactionState,
      transactionTypes,
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
        checkSender,
        checkReceiver,
        transactionState,
        transactionTypes,
      }
    )

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

    if (
      (!initialTransactions ||
        senderMatchedTransactions.length > initialTransactions) &&
      senderMatchedTransactions.length > transactionsLimit
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
        },
      }
    } else if (
      (!initialTransactions ||
        receiverMatchedTransactions.length > initialTransactions) &&
      receiverMatchedTransactions.length > transactionsLimit
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('destination'),
        },
      }
    }
  }

  protected matchPattern(
    _transaction: Transaction,
    _direction?: 'origin' | 'destination',
    _userType?: 'sender' | 'receiver'
  ): boolean {
    throw new Error('Not implemented')
  }
}
