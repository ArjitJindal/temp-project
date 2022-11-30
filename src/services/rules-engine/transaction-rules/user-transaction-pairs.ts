import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { TransactionFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type UserTransactionPairsRuleParameters = {
  userPairsThreshold: number
  timeWindowInSeconds: number
  excludedUserIds?: string[]
}

export default class UserTransactionPairsRule extends TransactionRule<
  UserTransactionPairsRuleParameters,
  TransactionFilters
> {
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

  public async computeRule() {
    const { excludedUserIds } = this.parameters
    if (
      !this.transaction.originUserId ||
      !this.transaction.destinationUserId ||
      (excludedUserIds &&
        (excludedUserIds.includes(this.transaction.originUserId as string) ||
          excludedUserIds.includes(
            this.transaction.destinationUserId as string
          )))
    ) {
      return
    }

    const { userPairsThreshold } = this.parameters
    const sendingTransactions = await this.getSenderSendingTransactions()

    const hitResult: RuleHitResult = []
    if (sendingTransactions.length > userPairsThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {},
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {},
      })
    }
    return hitResult
  }

  protected async getSenderSendingTransactions() {
    const { timeWindowInSeconds } = this.parameters
    const possibleReceiverKeyIds = new Set(
      (this.filters.transactionTypes || [undefined]).map(
        (transactionType) =>
          getReceiverKeys(this.tenantId, this.transaction, transactionType)
            ?.PartitionKeyID
      )
    )
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const sendingTransactions = (
      await transactionRepository.getUserSendingTransactions(
        this.transaction.originUserId as string,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInSeconds, 'second')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        {
          transactionTypes: this.filters.transactionTypes,
          transactionState: this.filters.transactionState,
          originPaymentMethod: this.filters.paymentMethod,
          originCountries: this.filters.transactionCountries,
        },
        ['receiverKeyId']
      )
    ).concat({
      ...this.transaction,
      receiverKeyId: getReceiverKeys(
        this.tenantId,
        this.transaction,
        this.transaction.type
      )?.PartitionKeyID,
      senderKeyId: undefined,
    })
    return sendingTransactions.filter((transaction) =>
      possibleReceiverKeyIds.has(transaction.receiverKeyId)
    )
  }
}
