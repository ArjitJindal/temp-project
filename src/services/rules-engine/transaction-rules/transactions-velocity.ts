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
import { TimeWindow } from '../rule'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'
import { keyHasUserId } from '@/core/dynamodb/dynamodb-keys'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

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
          type: 'number',
          title: 'Transactions Limit',
        },
        timeWindow: {
          type: 'object',
          title: 'Time Window',
          properties: {
            units: { type: 'integer', title: 'Number of time unit' },
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
            },
            rollingBasis: {
              type: 'boolean',
              title: 'Rolling basis',
              description:
                'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
              nullable: true,
            },
          },
          required: ['units', 'granularity'],
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
          enum: ['ACH', 'CARD', 'IBAN', 'SWIFT', 'UPI', 'WALLET'],
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          enum: ['CONSUMER', 'BUSINESS'],
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
