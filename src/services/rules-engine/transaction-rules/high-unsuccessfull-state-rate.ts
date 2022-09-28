import { JSONSchemaType } from 'ajv'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleResult } from '@/services/rules-engine/rule'
import {
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '@/services/rules-engine/utils/time-utils'
import {
  getTransactionUserPastTransactionsCount,
  isTransactionInTargetTypes,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export type HighUnsuccessfullStateRateParameters =
  DefaultTransactionRuleParameters & {
    transactionState: TransactionState
    transactionTypes?: TransactionType[]
    timeWindow: TimeWindow
    threshold: number
    minimumTransactions: number
    checkSender: 'sending' | 'all' | 'none'
    checkReceiver: 'receiving' | 'all' | 'none'
  }

export default class HighUnsuccessfullStateRateRule extends TransactionRule<HighUnsuccessfullStateRateParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighUnsuccessfullStateRateParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
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
          nullable: false,
        },
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
          nullable: true,
        },
        threshold: {
          type: 'number',
          title: 'Maximum rate of transactions of specified state',
          nullable: false,
        },
        minimumTransactions: {
          type: 'number',
          title: 'Transactions number user need to make before rule is checked',
          nullable: false,
        },
        // todo: generalize
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'], // check origin user, only for sending transactions or as a receiver too
          nullable: false,
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
          nullable: false,
        },
      },
      required: [
        'transactionState',
        'timeWindow',
        'checkSender',
        'checkReceiver',
      ],
    }
  }

  public getFilters() {
    const { transactionTypes } = this.parameters
    return [
      ...super.getFilters(),
      () => isTransactionInTargetTypes(this.transaction.type, transactionTypes),
    ]
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const {
      senderSendingTransactionsCount: senderSendingFullCount,
      senderReceivingTransactionsCount: senderReceivingFullCount,
      receiverSendingTransactionsCount: receiverSendingFullCount,
      receiverReceivingTransactionsCount: receiverReceivingFullCount,
    } = await getTransactionUserPastTransactionsCount(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkSender: this.parameters.checkSender,
        checkReceiver: this.parameters.checkReceiver,
        transactionTypes: this.parameters.transactionTypes,
      }
    )

    const {
      senderSendingTransactionsCount: senderSendingFilteredCount,
      senderReceivingTransactionsCount: senderReceivingFilteredCount,
      receiverSendingTransactionsCount: receiverSendingFilteredCount,
      receiverReceivingTransactionsCount: receiverReceivingFilteredCount,
    } = await getTransactionUserPastTransactionsCount(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkSender: this.parameters.checkSender,
        checkReceiver: this.parameters.checkReceiver,
        transactionTypes: this.parameters.transactionTypes,
        transactionState: this.parameters.transactionState,
      }
    )

    // +1 is for current transaction
    const senderFullCount =
      (senderSendingFullCount ?? 0) + (senderReceivingFullCount ?? 0) + 1
    const senderFilteredCount =
      (senderSendingFilteredCount ?? 0) +
      (senderReceivingFilteredCount ?? 0) +
      1

    const receiverFullCount =
      (receiverReceivingFullCount ?? 0) + (receiverSendingFullCount ?? 0) + 1
    const receiverFilteredCount =
      (receiverReceivingFilteredCount ?? 0) +
      (receiverSendingFilteredCount ?? 0) +
      1

    if (
      this.parameters.checkSender !== 'none' &&
      senderFullCount >= this.parameters.minimumTransactions
    ) {
      const rate = senderFilteredCount / senderFullCount

      if (rate > this.parameters.threshold) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars('origin'),
          },
        }
      }
    }
    if (
      this.parameters.checkReceiver !== 'none' &&
      receiverFullCount >= this.parameters.minimumTransactions
    ) {
      const rate = receiverFilteredCount / receiverFullCount
      if (rate > this.parameters.threshold) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars('destination'),
          },
        }
      }
    }

    return undefined
  }
}
