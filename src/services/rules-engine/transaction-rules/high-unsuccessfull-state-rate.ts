import { JSONSchemaType } from 'ajv'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_STATE_SCHEMA,
  CHECK_SENDER_SCHEMA,
  CHECK_RECEIVER_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { getTransactionUserPastTransactionsCount } from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export type HighUnsuccessfullStateRateParameters = {
  transactionState: TransactionState
  timeWindow: TimeWindow
  threshold: number
  minimumTransactions: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

export default class HighUnsuccessfullStateRateRule extends TransactionRule<
  HighUnsuccessfullStateRateParameters,
  TransactionFilters
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighUnsuccessfullStateRateParameters> {
    return {
      type: 'object',
      properties: {
        transactionState: TRANSACTION_STATE_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        threshold: {
          type: 'number',
          title:
            'Maximum rate of transactions of specified state (as a percentage)',
          nullable: false,
        },
        minimumTransactions: {
          type: 'number',
          title: 'Transactions number user need to make before rule is checked',
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
      },
      required: [
        'transactionState',
        'timeWindow',
        'checkSender',
        'checkReceiver',
      ],
    }
  }

  public async computeRule() {
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
        transactionTypes: this.filters.transactionTypes,
        transactionState: this.parameters.transactionState,
        paymentMethod: this.filters.paymentMethod,
        country: this.filters.transactionCountries,
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

    const hitResult: RuleHitResult = []
    if (
      this.parameters.checkSender !== 'none' &&
      senderFullCount >= this.parameters.minimumTransactions
    ) {
      const rate = (senderFilteredCount / senderFullCount) * 100

      if (rate > this.parameters.threshold) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
        })
      }
    }
    if (
      this.parameters.checkReceiver !== 'none' &&
      receiverFullCount >= this.parameters.minimumTransactions
    ) {
      const rate = (receiverFilteredCount / receiverFullCount) * 100
      if (rate > this.parameters.threshold) {
        hitResult.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
        })
      }
    }

    return hitResult
  }
}
