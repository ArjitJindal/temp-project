import { JSONSchemaType } from 'ajv'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  PAYMENT_METHOD_OPTIONAL_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
  TRANSACTION_STATE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTransactionUserPastTransactionsCount } from '@/services/rules-engine/utils/transaction-rule-utils'

export type SamePaymentDetailsParameters = DefaultTransactionRuleParameters & {
  timeWindow: TimeWindow
  threshold: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  paymentMethod?: string
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
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        paymentMethod: PAYMENT_METHOD_OPTIONAL_SCHEMA(),
      },
      required: ['timeWindow', 'threshold'],
    }
  }

  public getFilters() {
    const { paymentMethod } = this.parameters

    const result = [...super.getFilters()]
    if (paymentMethod != null) {
      result.push(
        () => this.transaction.originPaymentDetails?.method === paymentMethod
      )
    }

    return result
  }

  public async computeRule(): Promise<RuleResult | undefined> {
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

    const action = this.action
    const senderTotal = (senderSending ?? 0) + (senderReceiving ?? 0) + 1
    if (senderTotal >= threshold) {
      return {
        action,
        vars: {
          ...super.getTransactionVars('origin'),
          numberOfUses: senderTotal,
        },
      }
    }
    const receiverTotal = (receiverReceiving ?? 0) + (receiverSending ?? 0) + 1
    if (receiverTotal >= threshold) {
      return {
        action,
        vars: {
          ...super.getTransactionVars('destination'),
          numberOfUses: receiverTotal,
        },
      }
    }
    return undefined
  }
}
