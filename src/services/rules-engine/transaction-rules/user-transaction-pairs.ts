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
      await transactionRepository.getAfterTimeUserSendingThinTransactions(
        this.senderUser!.userId,
        dayjs(this.transaction.timestamp)
          .subtract(timeWindowInSeconds, 'second')
          .valueOf(),
        transactionType
      )
    ).concat([
      {
        transactionId: this.transaction.transactionId as string,
        timestamp: this.transaction.timestamp,
        receiverKeyId,
        senderKeyId: undefined,
      },
    ])
    return sendingTransactions.filter(
      (transaction) => transaction.receiverKeyId === receiverKeyId
    )
  }
}
