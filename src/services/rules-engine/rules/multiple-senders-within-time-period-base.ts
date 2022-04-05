import dayjs from 'dayjs'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { Rule } from './rule'
import { keyHasUserId } from '@/core/dynamodb/dynamodb-keys'

type MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: number
  timePeriodDays: number
}

export type SenderReceiverTypes = {
  senderTypes: Array<'USER' | 'NON_USER'>
  receiverTypes: Array<'USER' | 'NON_USER'>
}

export default class MultipleSendersWithinTimePeriodRuleBase extends Rule<MultipleSendersWithinTimePeriodRuleParameters> {
  protected getSenderReceiverTypes(): SenderReceiverTypes {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { timePeriodDays, sendersCount } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

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
      return { action: this.action }
    }
  }
}
