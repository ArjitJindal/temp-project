import { JSONSchemaType } from 'ajv'
import {
  ThinTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  TimeWindow,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { keyHasUserId } from '@/core/dynamodb/dynamodb-keys'
import { subtractTime } from '@/services/rules-engine/utils/time-utils'

export type MultipleSendersWithinTimePeriodRuleParameters =
  DefaultTransactionRuleParameters & {
    sendersCount: number
    timeWindow: TimeWindow
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
        sendersCount: {
          type: 'integer',
          title: 'Senders Count Threshold',
          description:
            'rule is run when the senders count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
      },
      required: ['sendersCount', 'timeWindow'],
    }
  }

  protected getSenderReceiverTypes(): SenderReceiverTypes {
    throw new Error('Not implemented')
  }

  public async computeRule() {
    const { timeWindow, sendersCount, transactionState } = this.parameters
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const afterTimestamp = subtractTime(
      dayjs(this.transaction.timestamp),
      timeWindow
    )
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
