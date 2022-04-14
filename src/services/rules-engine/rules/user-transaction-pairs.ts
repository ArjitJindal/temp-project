import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getReceiverKeys } from '../utils'
import { Rule } from './rule'

export type UserTransactionPairsRuleParameters = {
  userPairsThreshold: number
  timeWindowInDays: number
  transactionType?: string
}

export default class UserTransactionPairsRule extends Rule<UserTransactionPairsRuleParameters> {
  transactionRepository?: TransactionRepository

  public getFilters() {
    const { transactionType } = this.parameters
    return [
      () => !transactionType || this.transaction.type === transactionType,
      () => this.senderUser !== undefined && this.receiverUser !== undefined,
    ]
  }

  public async computeRule() {
    const { userPairsThreshold, timeWindowInDays, transactionType } =
      this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const receiverKeyId = getReceiverKeys(
      this.tenantId,
      this.transaction,
      transactionType
    ).PartitionKeyID
    const sendingTransactions =
      await transactionRepository.getAfterTimeUserSendingThinTransactions(
        this.senderUser!.userId,
        dayjs
          .unix(this.transaction.timestamp)
          .subtract(timeWindowInDays, 'day')
          .unix(),
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
