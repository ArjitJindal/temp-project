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
        transactionsPerSecond: { type: 'number' },
        timeWindowInSeconds: { type: 'integer' },
        userIdsToCheck: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        checkTimeWindow: {
          type: 'object',
          properties: { from: { type: 'string' }, to: { type: 'string' } },
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
    const { transactionsPerSecond, timeWindowInSeconds } = this.parameters
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
    const senderTransactionsCountPromise = this.transaction.originUserId
      ? this.getTransactionsCount(this.transaction.originUserId, afterTimestamp)
      : Promise.resolve(0)
    const receiverTransactionsCountPromise = this.transaction.destinationUserId
      ? this.getTransactionsCount(
          this.transaction.destinationUserId,
          afterTimestamp
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

  private async getTransactionsCount(userId: string, afterTimestamp: number) {
    const transactionRepository = this
      .transactionRepository as TransactionRepository
    const transactionsCount = await Promise.all([
      transactionRepository.getUserSendingTransactionsCount(userId, {
        afterTimestamp,
        beforeTimestamp: this.transaction.timestamp!,
      }),
      transactionRepository.getUserReceivingTransactionsCount(userId, {
        afterTimestamp,
        beforeTimestamp: this.transaction.timestamp!,
      }),
    ])
    return transactionsCount[0].count + transactionsCount[1].count
  }
}
