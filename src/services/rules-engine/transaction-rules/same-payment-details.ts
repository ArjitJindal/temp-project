import { JSONSchemaType } from 'ajv'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { getTransactionUserPastTransactionsCount } from '@/services/rules-engine/utils/transaction-rule-utils'

export type SamePaymentDetailsParameters = {
  timeWindow: TimeWindow
  threshold: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

export default class SamePaymentDetailsRule extends TransactionRule<SamePaymentDetailsParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<SamePaymentDetailsParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        threshold: {
          type: 'number',
          title:
            'Number of times payment details need to be used to trigger the rule',
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
      },
      required: ['timeWindow', 'threshold'],
    }
  }

  public async computeRule() {
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const { timeWindow, checkReceiver, checkSender, threshold } =
      this.parameters
    const {
      senderSendingTransactionsCount: senderSending,
      senderReceivingTransactionsCount: senderReceiving,
      receiverReceivingTransactionsCount: receiverReceiving,
      receiverSendingTransactionsCount: receiverSending,
    } = await getTransactionUserPastTransactionsCount(
      {
        ...this.transaction,
        originUserId: undefined, // to force search by payment details
        destinationUserId: undefined,
      },
      this.transactionRepository,
      {
        timeWindow,
        checkReceiver,
        checkSender,
      }
    )

    const hitResult: RuleHitResult = []
    const senderTotal = (senderSending ?? 0) + (senderReceiving ?? 0) + 1
    if (senderTotal >= threshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          numberOfUses: senderTotal,
        },
      })
    }
    const receiverTotal = (receiverReceiving ?? 0) + (receiverSending ?? 0) + 1
    if (receiverTotal >= threshold) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          numberOfUses: receiverTotal,
        },
      })
    }
    return hitResult
  }
}
