import { JSONSchemaType } from 'ajv'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import {
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '@/services/rules-engine/utils/time-utils'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTransactionUserPastTransactionsCount } from '@/services/rules-engine/utils/transaction-rule-utils'

export type SamePaymentDetailsParameters = DefaultTransactionRuleParameters & {
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
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'],
          nullable: false,
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
          nullable: false,
        },
      },
      required: ['timeWindow', 'threshold'],
    }
  }

  public getFilters() {
    return [...super.getFilters()]
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
