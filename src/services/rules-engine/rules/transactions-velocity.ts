import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'
import { MissingRuleParameter } from './errors'

export type TransactionsVelocityRuleParameters = {
  transactionsPerSecond: number
  timeWindowInSeconds: number
}

export default class TransactionsVelocityRule extends Rule<TransactionsVelocityRuleParameters> {
  transactionRepository?: TransactionRepository

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

    const afterTimestamp = dayjs
      .unix(this.transaction.timestamp)
      .subtract(timeWindowInSeconds, 'seconds')
      .unix()
    const senderTransactionsCountPromise = this.transaction.senderUserId
      ? this.getTransactionsCount(this.transaction.senderUserId, afterTimestamp)
      : Promise.resolve(0)
    const receiverTransactionsCountPromise = this.transaction.receiverUserId
      ? this.getTransactionsCount(
          this.transaction.receiverUserId,
          afterTimestamp
        )
      : Promise.resolve(0)
    const [senderTransactionsCount, receiverTransactionsCount] =
      await Promise.all([
        senderTransactionsCountPromise,
        receiverTransactionsCountPromise,
      ])

    if (
      (this.transaction.senderUserId &&
        (senderTransactionsCount + 1) / timeWindowInSeconds >
          transactionsPerSecond) ||
      (this.transaction.receiverUserId &&
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
      transactionRepository.getAfterTimeUserSendingTransactionsCount(
        userId,
        afterTimestamp
      ),
      transactionRepository.getAfterTimeUserReceivingTransactionsCount(
        userId,
        afterTimestamp
      ),
    ])
    return transactionsCount[0].count + transactionsCount[1].count
  }
}
