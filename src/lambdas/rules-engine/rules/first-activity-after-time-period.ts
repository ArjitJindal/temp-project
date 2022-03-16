import dayjs from 'dayjs'
import { RuleParameters } from '../../../@types/rule/rule-instance'
import { TransactionRepository } from '../repositories/transaction-repository'
import { Rule, RuleInfo } from './rule'

type FirstActivityAfterLongTimeRuleParameters = RuleParameters & {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends Rule<FirstActivityAfterLongTimeRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'first_activity_after_long_time',
      displayName:
        'First activity of client after a long period of dormancy period t',
      description:
        "First activity of client after a long period of dormancy period t. Users get suspended if they haven't done any transactions for a long period of time t.",
    }
  }

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
        dayjs(this.transaction.timestamp).diff(
          lastSendingThinTransaction.timestamp,
          'day'
        ) > this.parameters.dormancyPeriodDays
      ) {
        return { action: this.parameters.action }
      }
    }
  }
}
