import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserInList, isUserType } from '../utils/user-rule-utils'
import { isTransactionWithinTimeWindow } from '../utils/transaction-rule-utils'
import { subtractTime } from '../utils/time-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { UserType } from '@/@types/user/user-type'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
}

export type TransactionsVelocityRuleParameters =
  DefaultTransactionRuleParameters & {
    transactionsLimit: number
    timeWindow: TimeWindow

    checkSender?: 'sending' | 'all' | 'none'
    checkReceiver?: 'receiving' | 'all' | 'none'

    // Optional parameters
    userIdsToCheck?: string[] // If empty, all users will be checked
    checkTimeWindow?: {
      from: string // e.g 20:20:39+03:00
      to: string
    }
    transactionType?: string
    paymentMethod?: PaymentMethod
    userType?: UserType
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
              nullable: true,
              description:
                'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
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
            from: { type: 'string', title: 'From (format: 00:00:00+00:00)' },
            to: { type: 'string', title: 'To (format: 00:00:00+00:00)' },
          },
          required: ['from', 'to'],
          nullable: true,
        },
        transactionType: {
          type: 'string',
          title: 'Target Transaction Type',
          nullable: true,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          nullable: true,
        },
      },
      required: ['transactionsLimit', 'timeWindow'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const {
      userIdsToCheck,
      checkTimeWindow,
      transactionType,
      paymentMethod,
      userType,
    } = this.parameters
    return super
      .getFilters()
      .concat([
        () => isUserInList(this.senderUser, userIdsToCheck),
        () => isTransactionWithinTimeWindow(this.transaction, checkTimeWindow),
        () => !transactionType || this.transaction.type === transactionType,
        () =>
          !paymentMethod ||
          this.transaction.originPaymentDetails?.method === paymentMethod,
        () => isUserType(this.senderUser, userType),
      ])
  }

  public async computeRule() {
    const { transactionsLimit, timeWindow, checkSender, checkReceiver } =
      this.parameters
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

    const senderTransactionsCountPromise =
      this.transaction.originUserId && checkSender
        ? this.getTransactionsCount(
            this.transaction.originUserId,
            afterTimestamp,
            checkSender
          )
        : Promise.resolve(0)
    const receiverTransactionsCountPromise =
      this.transaction.destinationUserId && checkReceiver
        ? this.getTransactionsCount(
            this.transaction.destinationUserId,
            afterTimestamp,
            checkReceiver
          )
        : Promise.resolve(0)
    const [senderTransactionsCount, receiverTransactionsCount] =
      await Promise.all([
        senderTransactionsCountPromise,
        receiverTransactionsCountPromise,
      ])

    if (
      (this.transaction.originUserId &&
        senderTransactionsCount + 1 > transactionsLimit) ||
      (this.transaction.destinationUserId &&
        receiverTransactionsCount + 1 > transactionsLimit)
    ) {
      return { action: this.action }
    }
  }

  private async getTransactionsCount(
    userId: string,
    afterTimestamp: number,
    checkType: 'sending' | 'receiving' | 'all' | 'none'
  ) {
    const transactionRepository = this
      .transactionRepository as TransactionRepository
    const transactionsCount = await Promise.all([
      checkType === 'sending' || checkType === 'all'
        ? transactionRepository.getUserSendingTransactionsCount(
            userId,
            {
              afterTimestamp,
              beforeTimestamp: this.transaction.timestamp!,
            },
            { transactionState: this.parameters.transactionState }
          )
        : Promise.resolve({ count: 0 }),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getUserReceivingTransactionsCount(
            userId,
            {
              afterTimestamp,
              beforeTimestamp: this.transaction.timestamp!,
            },
            { transactionState: this.parameters.transactionState }
          )
        : Promise.resolve({ count: 0 }),
    ])
    return transactionsCount[0].count + transactionsCount[1].count
  }
}
