import _ from 'lodash'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'

export type ConsecutiveTransactionSameTypeRuleParameters = {
  targetTransactionsThreshold: number
  targetTransactionType: string
  otherTransactionTypes: string[]
  timeWindowInDays: number
}

export default class ConsecutiveTransactionsameTypeRule extends Rule<ConsecutiveTransactionSameTypeRuleParameters> {
  transactionRepository?: TransactionRepository

  public getFilters() {
    const { targetTransactionType } = this.parameters
    return [
      () => this.transaction.type === targetTransactionType,
      () => this.senderUser !== undefined,
    ]
  }

  public async computeRule() {
    const {
      targetTransactionType,
      otherTransactionTypes,
      targetTransactionsThreshold,
      timeWindowInDays,
    } = this.parameters
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const [targetTransactions, ...otherTransactionsList] = await Promise.all([
      transactionRepository.getLastNUserSendingThinTransactions(
        this.senderUser!.userId,
        targetTransactionsThreshold,
        targetTransactionType
      ),
      ...(otherTransactionTypes || []).map((transactionType) =>
        transactionRepository.getLastNUserSendingThinTransactions(
          this.senderUser!.userId,
          1,
          transactionType
        )
      ),
    ])

    const afterTimestamp = dayjs
      .unix(this.transaction.timestamp)
      .subtract(timeWindowInDays, 'day')
    const filteredTargetTransactions = targetTransactions.filter(
      (transaction) => dayjs.unix(transaction.timestamp) > afterTimestamp
    )
    const lastOtherTransaction = _.last(
      _.sortBy(
        otherTransactionsList
          .map((otherTransactions) => otherTransactions[0])
          .filter(Boolean),
        'timestamp'
      ).filter(
        (transaction) => dayjs.unix(transaction.timestamp) > afterTimestamp
      )
    )

    const lastTargetTransactionTimestamp = _.last(
      filteredTargetTransactions
    )?.timestamp
    const lastTransactionTimestamp = lastOtherTransaction?.timestamp
    if (
      filteredTargetTransactions.length + 1 > targetTransactionsThreshold &&
      (!lastTransactionTimestamp ||
        (lastTargetTransactionTimestamp &&
          lastTransactionTimestamp < lastTargetTransactionTimestamp))
    ) {
      return {
        action: this.action,
      }
    }
  }
}
