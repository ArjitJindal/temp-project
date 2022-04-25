import dayjs from 'dayjs'
import { JSONSchemaType } from 'ajv'
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
  public static getSchema(): JSONSchemaType<MultipleSendersWithinTimePeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        sendersCount: { type: 'integer' },
        timePeriodDays: { type: 'integer' },
      },
      required: ['sendersCount', 'timePeriodDays'],
      additionalProperties: false,
    }
  }

  protected getSenderReceiverTypes(): SenderReceiverTypes {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { timePeriodDays, sendersCount } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = dayjs
      .unix(this.transaction.timestamp)
      .subtract(timePeriodDays, 'day')
      .unix()
    let senderTransactions: ThinTransaction[] = []
    if (receiverTypes.includes('USER') && this.transaction.destinationUserId) {
      senderTransactions =
        await transactionRepository.getAfterTimeUserReceivingThinTransactions(
          this.transaction.destinationUserId,
          afterTimestamp
        )
    } else if (receiverTypes.includes('NON_USER')) {
      senderTransactions =
        await transactionRepository.getAfterTimeNonUserReceivingThinTransactions(
          this.transaction.destinationPaymentDetails,
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
