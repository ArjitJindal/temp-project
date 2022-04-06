import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule } from './rule'

type FirstActivityAfterLongTimeRuleParameters = {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends Rule<FirstActivityAfterLongTimeRuleParameters> {
  public async computeRule() {
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const lastSendingThinTransaction =
      this.transaction.senderUserId &&
      (
        await transactionRepository.getLastNUserSendingThinTransactions(
          this.transaction.senderUserId,
          1
        )
      )[0]
    if (lastSendingThinTransaction) {
      if (
        dayjs
          .unix(this.transaction.timestamp)
          .diff(lastSendingThinTransaction.timestamp, 'day') >
        this.parameters.dormancyPeriodDays
      ) {
        return { action: this.action }
      }
    }
  }
}
