import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserType } from '../utils/user-rule-utils'
import {
  getTransactionUserPastTransactions,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  INITIAL_TRANSACTIONS_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

export type TransactionsPatternPercentageRuleParameters =
  DefaultTransactionRuleParameters & {
    patternPercentageLimit: number
    timeWindow: TimeWindow
    initialTransactions: number

    // Optional parameters
    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    userType?: UserType
  }

export default class TransactionsPatternPercentageBaseRule<
  T extends TransactionsPatternPercentageRuleParameters
> extends TransactionRule<T> {
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
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['initialTransactions', 'patternPercentageLimit', 'timeWindow'],
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
        checkSender,
        checkReceiver,
        transactionState,
        transactionTypes,
      }
    )

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
    const receiverTransactions = receiverSendingTransactions
      .concat(receiverReceivingTransactions)
      .concat(this.transaction)
    const receiverMatchedTransactions = [
      ...receiverSendingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'origin')
      ),
      ...receiverReceivingTransactions
        .concat(this.transaction)
        .filter((transaction) => this.matchPattern(transaction, 'destination')),
    ]
    const receiverMatchPercentage =
      (receiverMatchedTransactions.length / receiverTransactions.length) * 100

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
    } else if (
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

  protected matchPattern(
    _transaction: Transaction,
    _direction?: 'origin' | 'destination'
  ): boolean {
    throw new Error('Not implemented')
  }
}
