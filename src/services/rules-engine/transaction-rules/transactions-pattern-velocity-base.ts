import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserType } from '../utils/user-rule-utils'
import {
  getTransactionUserPastTransactions,
  isTransactionInTargetTypes,
} from '../utils/transaction-rule-utils'
import {
  PAYMENT_METHODS,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/time-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { UserType } from '@/@types/user/user-type'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type TransactionsPatternVelocityRuleParameters =
  DefaultTransactionRuleParameters & {
    transactionsLimit: number
    timeWindow: TimeWindow

    // Optional parameters
    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'
    initialTransactions?: number
    transactionTypes?: TransactionType[]
    paymentMethod?: string
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
        transactionsLimit: {
          type: 'integer',
          title: 'Transactions Limit',
        },
        initialTransactions: {
          type: 'integer',
          title: 'Initial Transactions Count Threshold',
          nullable: true,
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
          nullable: true,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          enum: PAYMENT_METHODS,
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          enum: ['CONSUMER', 'BUSINESS'],
          nullable: true,
        },
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'],
          nullable: true,
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
          nullable: true,
        },
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
        .filter((transaction) => this.matchPattern(transaction, 'origin')),
      ...senderReceivingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'destination')
      ),
    ]
    const receiverMatchedTransactions = [
      ...receiverSendingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'origin')
      ),
      ...receiverReceivingTransactions
        .concat(this.transaction)
        .filter((transaction) => this.matchPattern(transaction, 'destination')),
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
    _direction?: 'origin' | 'destination'
  ): boolean {
    throw new Error('Not implemented')
  }
}
