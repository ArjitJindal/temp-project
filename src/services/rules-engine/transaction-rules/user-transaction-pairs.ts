import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { TransactionRule } from './rule'

export type UserTransactionPairsRuleParameters = {
  userPairsThreshold: number
  timeWindowInSeconds: number
  transactionType?: string
  excludedUserIds?: string[]
}

export default class UserTransactionPairsRule extends TransactionRule<UserTransactionPairsRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<UserTransactionPairsRuleParameters> {
    return {
      type: 'object',
      properties: {
        userPairsThreshold: {
          type: 'integer',
          title: 'User Pairs Count Threshold',
        },
        timeWindowInSeconds: {
          type: 'integer',
          title: 'Time Window (Seconds)',
        },
        transactionType: {
          type: 'string',
          title: 'Target Transaction Type',
          nullable: true,
        },
        excludedUserIds: {
          type: 'array',
          title: 'Excluded User IDs',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: ['userPairsThreshold', 'timeWindowInSeconds'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { transactionType, excludedUserIds } = this.parameters
    return [
      () => !transactionType || this.transaction.type === transactionType,
      () =>
        this.transaction.originUserId !== undefined &&
        this.transaction.destinationUserId !== undefined,
      () =>
        excludedUserIds === undefined ||
        (!excludedUserIds.includes(this.transaction.originUserId as string) &&
          !excludedUserIds.includes(
            this.transaction.destinationUserId as string
          )),
    ]
  }

  public async computeRule() {
    const { userPairsThreshold } = this.parameters
    const sendingTransactions = await this.getSenderSendingTransactions()

    if (sendingTransactions.length > userPairsThreshold) {
      return { action: this.action }
    }
  }

  protected async getSenderSendingTransactions() {
    const { timeWindowInSeconds, transactionType } = this.parameters
    const receiverKeyId = getReceiverKeys(
      this.tenantId,
      this.transaction,
      transactionType
    )?.PartitionKeyID
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const sendingTransactions = (
      await transactionRepository.getUserSendingThinTransactions(
        this.transaction.originUserId as string,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInSeconds, 'second')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        transactionType
      )
    ).concat([
      {
        transactionId: this.transaction.transactionId as string,
        timestamp: this.transaction.timestamp!,
        receiverKeyId,
        senderKeyId: undefined,
      },
    ])
    return sendingTransactions.filter(
      (transaction) => transaction.receiverKeyId === receiverKeyId
    )
  }
}
