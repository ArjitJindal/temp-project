import dayjs from 'dayjs'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Rule, RuleInfo, RuleParameters } from './rule'

type FirstActivityAfterLongTimeRuleParameters = RuleParameters & {
  dormancyPeriodDays: number
}

export default class FirstActivityAfterLongTimeRule extends Rule<FirstActivityAfterLongTimeRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'first_activity_after_long_time',
      displayName:
        'First activity of client after a long period of dormancy period',
      description:
        'A customer is inactive for a long time (not making transactions), then does a transaction',
    }
  }

  public async computeRule() {
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )

    const userLastTransactionTime =
      await aggregationRepository.getUserLastTransactionTime(
        this.transaction.senderUserId
      )
    if (userLastTransactionTime) {
      if (
        dayjs(this.transaction.timestamp).diff(userLastTransactionTime, 'day') >
        this.parameters.dormancyPeriodDays
      ) {
        return { action: this.parameters.action }
      }
    }
  }
}
