import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { isTransactionInTargetTypes } from '../utils/transaction-rule-utils'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export type UserTransactionPairsRuleParameters =
  DefaultTransactionRuleParameters & {
    userPairsThreshold: number
    timeWindowInSeconds: number
    transactionTypes: TransactionType[]
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
        excludedUserIds: {
          type: 'array',
          title: 'Excluded User IDs',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: ['userPairsThreshold', 'timeWindowInSeconds'],
    }
  }

  public getFilters() {
    const { transactionTypes, excludedUserIds } = this.parameters
    return super
      .getFilters()
      .concat([
        () =>
          isTransactionInTargetTypes(this.transaction.type, transactionTypes),
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
    const { timeWindowInSeconds, transactionTypes, transactionState } =
      this.parameters
    const possibleReceiverKeyIds = new Set(
      (transactionTypes || [undefined]).map(
        (transactionType) =>
          getReceiverKeys(this.tenantId, this.transaction, transactionType)
            ?.PartitionKeyID
      )
    )
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
        { transactionTypes, transactionState }
      )
    ).concat([
      {
        transactionId: this.transaction.transactionId as string,
        timestamp: this.transaction.timestamp!,
        receiverKeyId: getReceiverKeys(
          this.tenantId,
          this.transaction,
          this.transaction.type
        )?.PartitionKeyID,
        senderKeyId: undefined,
      },
    ])
    return sendingTransactions.filter((transaction) =>
      possibleReceiverKeyIds.has(transaction.receiverKeyId)
    )
  }
}
