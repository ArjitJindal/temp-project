import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import {
  ThinTransaction,
  ThinTransactionsFilterOptions,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { isUserInList, isUserType } from '../utils/user-rule-utils'
import {
  isTransactionInTargetTypes,
  isTransactionWithinTimeWindow,
} from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  USER_TYPE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'
import { keyHasUserId } from '@/core/dynamodb/dynamodb-keys'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export type TransactionsVelocityRuleParameters =
  DefaultTransactionRuleParameters & {
    transactionsLimit: number
    timeWindow: TimeWindow

    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'

    // Optional parameters
    userIdsToCheck?: string[] // If empty, all users will be checked
    checkTimeWindow?: {
      from?: string // e.g 20:20:39+03:00
      to?: string
    }
    transactionTypes?: TransactionType[]
    paymentMethod?: PaymentMethod
    userType?: UserType
    onlyCheckKnownUsers?: boolean
  }

export default class TransactionsVelocityRule extends TransactionRule<TransactionsVelocityRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
        userIdsToCheck: {
          type: 'array',
          title: 'Target User IDs',
          items: { type: 'string' },
          nullable: true,
        },
        checkTimeWindow: {
          type: 'object',
          title: 'Time Window',
          properties: {
            from: {
              type: 'string',
              title: 'From (format: 00:00:00+00:00)',
              nullable: true,
            },
            to: {
              type: 'string',
              title: 'To (format: 00:00:00+00:00)',
              nullable: true,
            },
          },
          nullable: true,
        },
        onlyCheckKnownUsers: {
          type: 'boolean',
          title: 'Only check transactions from known users (with user ID)',
          nullable: true,
        },
      },
      required: ['transactionsLimit', 'timeWindow'],
    }
  }

  public getFilters() {
    const {
      userIdsToCheck,
      checkTimeWindow,
      transactionTypes,
      paymentMethod,
      userType,
      onlyCheckKnownUsers,
    } = this.parameters
    return super
      .getFilters()
      .concat([
        () => isUserInList(this.senderUser, userIdsToCheck),
        () => isTransactionWithinTimeWindow(this.transaction, checkTimeWindow),
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
        () =>
          !paymentMethod ||
          this.transaction.originPaymentDetails?.method === paymentMethod,
        () => isUserType(this.senderUser, userType),
        () =>
          onlyCheckKnownUsers
            ? !!this.transaction.originUserId &&
              !!this.transaction.destinationUserId
            : true,
      ])
  }

  public async computeRule() {
    const {
      transactionsLimit,
      timeWindow,
      checkSender,
      checkReceiver,
      onlyCheckKnownUsers,
    } = this.parameters
    if (transactionsLimit === undefined) {
      throw new MissingRuleParameter()
    }

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )

    const senderTransactionsCountPromise = checkSender
      ? this.getTransactionsCount(
          this.transaction.originUserId,
          this.transaction.originPaymentDetails,
          afterTimestamp,
          checkSender,
          onlyCheckKnownUsers
        )
      : Promise.resolve(0)
    const receiverTransactionsCountPromise = checkReceiver
      ? this.getTransactionsCount(
          this.transaction.destinationUserId,
          this.transaction.destinationPaymentDetails,
          afterTimestamp,
          checkReceiver,
          onlyCheckKnownUsers
        )
      : Promise.resolve(0)
    const [senderTransactionsCount, receiverTransactionsCount] =
      await Promise.all([
        senderTransactionsCountPromise,
        receiverTransactionsCountPromise,
      ])

    if (
      senderTransactionsCount + 1 > transactionsLimit ||
      receiverTransactionsCount + 1 > transactionsLimit
    ) {
      let transactionsDif = null
      if (senderTransactionsCount + 1 > transactionsLimit) {
        transactionsDif = senderTransactionsCount - transactionsLimit + 1
      }
      if (receiverTransactionsCount + 1 > transactionsLimit) {
        transactionsDif = receiverTransactionsCount - transactionsLimit + 1
      }

      let direction: 'origin' | 'destination' | null = null
      if (senderTransactionsCount + 1 > transactionsLimit) {
        direction = 'origin'
      } else if (receiverTransactionsCount + 1 > transactionsLimit) {
        direction = 'destination'
      }

      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars(direction),
          transactionsDif: transactionsDif,
        },
      }
    }
  }

  private async getTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    afterTimestamp: number,
    checkType: 'sending' | 'receiving' | 'all' | 'none',
    onlyCheckKnownUsers = false
  ) {
    const transactionRepository = this
      .transactionRepository as TransactionRepository
    const timeRange = {
      afterTimestamp,
      beforeTimestamp: this.transaction.timestamp!,
    }
    const filterOptions: ThinTransactionsFilterOptions = {
      transactionState: this.parameters.transactionState,
      transactionTypes: this.parameters.transactionTypes,
    }
    const transactionsCount = await Promise.all([
      checkType === 'sending' || checkType === 'all'
        ? onlyCheckKnownUsers
          ? (async () =>
              this.getTransactionsCountForKnownUsers(
                await transactionRepository.getGenericUserSendingThinTransactions(
                  userId,
                  paymentDetails,
                  timeRange,
                  filterOptions
                ),
                'sending'
              ))()
          : transactionRepository.getGenericUserSendingTransactionsCount(
              userId,
              paymentDetails,
              timeRange,
              filterOptions
            )
        : Promise.resolve(0),
      checkType === 'receiving' || checkType === 'all'
        ? onlyCheckKnownUsers
          ? (async () =>
              this.getTransactionsCountForKnownUsers(
                await transactionRepository.getGenericUserReceivingThinTransactions(
                  userId,
                  paymentDetails,
                  timeRange,
                  filterOptions
                ),
                'receiving'
              ))()
          : transactionRepository.getGenericUserReceivingTransactionsCount(
              userId,
              paymentDetails,
              timeRange,
              filterOptions
            )
        : Promise.resolve(0),
    ])
    return transactionsCount[0] + transactionsCount[1]
  }

  private getTransactionsCountForKnownUsers(
    thinTransactions: ThinTransaction[],
    direction: 'sending' | 'receiving'
  ): number {
    return thinTransactions.filter((thinTransaction) =>
      keyHasUserId(
        (direction === 'sending'
          ? thinTransaction.receiverKeyId
          : thinTransaction.senderKeyId) || ''
      )
    ).length
  }
}
