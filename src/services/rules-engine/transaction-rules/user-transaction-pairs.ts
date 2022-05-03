import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { TransactionRule } from './rule'

export type UserTransactionPairsRuleParameters = {
  userPairsThreshold: number
  timeWindowInSeconds: number
  transactionType?: string
}

export default class UserTransactionPairsRule extends TransactionRule<UserTransactionPairsRuleParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<UserTransactionPairsRuleParameters> {
    return {
      type: 'object',
      properties: {
        userPairsThreshold: { type: 'integer' },
        timeWindowInSeconds: { type: 'integer' },
        transactionType: { type: 'string', nullable: true },
      },
      required: ['userPairsThreshold', 'timeWindowInSeconds'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    const { transactionType } = this.parameters
    return [
      () => !transactionType || this.transaction.type === transactionType,
      () => this.senderUser !== undefined && this.receiverUser !== undefined,
    ]
  }

  public async computeRule() {
    const { userPairsThreshold, timeWindowInSeconds, transactionType } =
      this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const receiverKeyId = getReceiverKeys(
      this.tenantId,
      this.transaction,
      transactionType
    )?.PartitionKeyID
    const sendingTransactions =
      await transactionRepository.getAfterTimeUserSendingThinTransactions(
        this.senderUser!.userId,
        dayjs(this.transaction.timestamp)
          .subtract(timeWindowInSeconds, 'second')
          .valueOf(),
        transactionType
      )

    const userPairsCount = sendingTransactions.filter(
      (transaction) => transaction.receiverKeyId === receiverKeyId
    ).length

    if (userPairsCount + 1 > userPairsThreshold) {
      return { action: this.action }
    }
  }
}
