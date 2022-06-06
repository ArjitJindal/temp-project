import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { isUserInList } from '../utils/user-rule-utils'
import { isTransactionWithinTimeWindow } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { MissingRuleParameter } from './errors'

export type TransactionsVelocityRuleParameters = {
  transactionsPerSecond: number
  timeWindowInSeconds: number

  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'

  // Optional parameters
  userIdsToCheck?: string[] // If empty, all users will be checked
  checkTimeWindow?: {
    from: string // e.g 20:20:39+03:00
    to: string
  }
}

export default class TransactionsVelocityRule extends TransactionRule<TransactionsVelocityRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionsPerSecond: {
          type: 'number',
          title: 'Transactions/sec Threshold',
        },
        timeWindowInSeconds: {
          type: 'integer',
          title: 'Time Window (Seconds)',
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
      },
      required: ['transactionsPerSecond', 'timeWindowInSeconds'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { userIdsToCheck, checkTimeWindow } = this.parameters
    return [
      () => isUserInList(this.senderUser, userIdsToCheck),
      () => isTransactionWithinTimeWindow(this.transaction, checkTimeWindow),
    ]
  }

  public async computeRule() {
    const {
      transactionsPerSecond,
      timeWindowInSeconds,
      checkSender,
      checkReceiver,
    } = this.parameters
    if (
      transactionsPerSecond === undefined ||
      timeWindowInSeconds === undefined
    ) {
      throw new MissingRuleParameter()
    }

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = dayjs(this.transaction.timestamp)
      .subtract(timeWindowInSeconds, 'seconds')
      .valueOf()

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
        (senderTransactionsCount + 1) / timeWindowInSeconds >
          transactionsPerSecond) ||
      (this.transaction.destinationUserId &&
        (receiverTransactionsCount + 1) / timeWindowInSeconds >
          transactionsPerSecond)
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
        ? transactionRepository.getUserSendingTransactionsCount(userId, {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          })
        : Promise.resolve({ count: 0 }),
      checkType === 'receiving' || checkType === 'all'
        ? transactionRepository.getUserReceivingTransactionsCount(userId, {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          })
        : Promise.resolve({ count: 0 }),
    ])
    return transactionsCount[0].count + transactionsCount[1].count
  }
}
