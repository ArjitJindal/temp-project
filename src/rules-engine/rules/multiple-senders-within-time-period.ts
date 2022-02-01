import dayjs from 'dayjs'
import { RuleParameters } from '../../@types/rule/rule-instance'
import { keyHasUserId } from '../../core/dynamodb/dynamodb-keys'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { Rule, RuleInfo } from './rule'

type MultipleSendersWithinTimePeriodRuleParameters = RuleParameters & {
  senderTypes: Array<'USER' | 'NON_USER'>
  receiverTypes: Array<'USER' | 'NON_USER'>
  sendersCount: number
  timePeriodDays: number
}

export default class MultipleSendersWithinTimePeriodRule extends Rule<MultipleSendersWithinTimePeriodRuleParameters> {
  public getInfo(): RuleInfo {
    return {
      name: 'multiple_senders_within_time_period',
      displayName: 'Multiple senders within time period',
      description:
        'More than x senders transacting with a single receiver within a set period of time t',
    }
  }

  public async computeRule() {
    const { action, senderTypes, receiverTypes, timePeriodDays, sendersCount } =
      this.parameters
    const transactionRepository = new TransactionRepository(
      this.tenantId,
      this.dynamoDb
    )

    const afterTimestamp = dayjs().subtract(timePeriodDays, 'day').unix()
    let senderTransactions: ThinTransaction[] = []
    if (receiverTypes.includes('USER') && this.transaction.receiverUserId) {
      senderTransactions =
        await transactionRepository.getAfterTimeUserReceivingThinTransactions(
          this.transaction.receiverUserId,
          afterTimestamp
        )
    } else if (receiverTypes.includes('NON_USER')) {
      senderTransactions =
        await transactionRepository.getAfterTimeNonUserReceivingThinTransactions(
          this.transaction.receiverPaymentDetails,
          afterTimestamp
        )
    }
    const uniqueSenders = new Set(
      senderTransactions
        .filter(
          (transaction) =>
            (senderTypes.includes('USER') &&
              transaction.senderKeyId &&
              keyHasUserId(transaction.senderKeyId)) ||
            senderTypes.includes('NON_USER')
        )
        .map((transaction) => transaction.senderKeyId)
    )
    if (uniqueSenders.size + 1 > sendersCount) {
      return { action }
    }
  }
}
