import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type UserTransactionPairsRuleParameters =
  DefaultTransactionRuleParameters & {
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
    return super
      .getFilters()
      .concat([
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
      ])
  }

  public async computeRule() {
    const { userPairsThreshold } = this.parameters
    const sendingTransactions = await this.getSenderSendingTransactions()

    if (sendingTransactions.length > userPairsThreshold) {
      return { action: this.action }
    }
  }

  protected async getSenderSendingTransactions() {
    const { timeWindowInSeconds, transactionType, transactionState } =
      this.parameters
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
        { transactionType, transactionState }
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
