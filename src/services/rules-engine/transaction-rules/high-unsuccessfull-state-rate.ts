import { JSONSchemaType } from 'ajv'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_STATE_SCHEMA,
  TRANSACTION_TYPES_OPTIONAL_SCHEMA,
  CHECK_SENDER_SCHEMA,
  CHECK_RECEIVER_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RuleResult } from '@/services/rules-engine/rule'
import {
  getTransactionUserPastTransactionsCount,
  isTransactionInTargetTypes,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

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
        transactionState: TRANSACTION_STATE_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        threshold: {
          type: 'number',
          title: 'Maximum rate of transactions of specified state',
        },
        minimumTransactions: {
          type: 'number',
          title: 'Transactions number user need to make before rule is checked',
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA(),
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
