import { JSONSchemaType } from 'ajv'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { keyHasUserId } from '@/core/dynamodb/dynamodb-keys'

export type MultipleSendersWithinTimePeriodRuleParameters =
  DefaultTransactionRuleParameters & {
    sendersCount: number
    timePeriodDays: number
  }

export type SenderReceiverTypes = {
  senderTypes: Array<'USER' | 'NON_USER'>
  receiverTypes: Array<'USER' | 'NON_USER'>
}

export default class MultipleSendersWithinTimePeriodRuleBase extends TransactionRule<MultipleSendersWithinTimePeriodRuleParameters> {
  public static getSchema(): JSONSchemaType<MultipleSendersWithinTimePeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        sendersCount: { type: 'integer', title: 'Senders Count Threshold' },
        timePeriodDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['sendersCount', 'timePeriodDays'],
    }
  }

  protected getSenderReceiverTypes(): SenderReceiverTypes {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { timePeriodDays, sendersCount, transactionState } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = dayjs(this.transaction.timestamp)
      .subtract(timePeriodDays, 'day')
      .valueOf()
    let senderTransactions: ThinTransaction[] = []
    if (receiverTypes.includes('USER') && this.transaction.destinationUserId) {
      senderTransactions =
        await transactionRepository.getUserReceivingThinTransactions(
          this.transaction.destinationUserId,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          { transactionState }
        )
    } else if (
      receiverTypes.includes('NON_USER') &&
      this.transaction.destinationPaymentDetails
    ) {
      senderTransactions =
        await transactionRepository.getNonUserReceivingThinTransactions(
          this.transaction.destinationPaymentDetails,
          {
            afterTimestamp,
            beforeTimestamp: this.transaction.timestamp!,
          },
          { transactionState }
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
      return { action: this.action, ...super.getTransactionVars(null) }
    }
  }
}
