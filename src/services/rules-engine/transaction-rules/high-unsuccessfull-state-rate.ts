import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_STATES_SCHEMA,
  CHECK_SENDER_SCHEMA,
  CHECK_RECEIVER_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { AuxiliaryIndexTransaction } from '@/services/rules-engine/repositories/transaction-repository'
import {
  getTransactionUserPastTransactions,
  groupTransactionsByHour,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

type AggregationData = {
  filteredSendingCount?: number
  filteredReceivingCount?: number
  allSendingCount?: number
  allReceivingCount?: number
}

export type HighUnsuccessfullStateRateParameters = {
  transactionStates: TransactionState[]
  timeWindow: TimeWindow
  threshold: number
  minimumTransactions: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

export default class HighUnsuccessfullStateRateRule extends TransactionAggregationRule<
  HighUnsuccessfullStateRateParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<HighUnsuccessfullStateRateParameters> {
    return {
      type: 'object',
      properties: {
        transactionStates: TRANSACTION_STATES_SCHEMA(),
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
        'transactionStates',
        'timeWindow',
        'checkSender',
        'checkReceiver',
      ],
    }
  }

  public async computeRule() {
    if (
      !this.parameters.transactionStates.includes(
        this.transaction.transactionState!
      )
    ) {
      return
    }

    const {
      senderSendingFullCount,
      senderReceivingFullCount,
      senderReceivingFilteredCount,
      senderSendingFilteredCount,
      receiverReceivingFullCount,
      receiverSendingFullCount,
      receiverReceivingFilteredCount,
      receiverSendingFilteredCount,
    } = await this.getTransactionCounts()

    const hitResult: RuleHitResult = []
    if (this.parameters.checkSender !== 'none') {
      const senderFullCount =
        senderSendingFullCount +
        (this.parameters.checkSender === 'sending'
          ? 0
          : senderReceivingFullCount) +
        1
      const senderFilteredCount =
        senderSendingFilteredCount +
        (this.parameters.checkSender === 'sending'
          ? 0
          : senderReceivingFilteredCount) +
        1
      const rate = (senderFilteredCount / senderFullCount) * 100

      if (
        senderFullCount >= this.parameters.minimumTransactions &&
        rate > this.parameters.threshold
      ) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: super.getTransactionVars('origin'),
        })
      }
    }
    if (this.parameters.checkReceiver !== 'none') {
      const receiverFullCount =
        receiverReceivingFullCount +
        (this.parameters.checkReceiver === 'receiving'
          ? 0
          : receiverSendingFullCount) +
        1
      const receiverFilteredCount =
        receiverReceivingFilteredCount +
        (this.parameters.checkReceiver === 'receiving'
          ? 0
          : receiverSendingFilteredCount) +
        1
      const rate = (receiverFilteredCount / receiverFullCount) * 100
      if (
        receiverFullCount >= this.parameters.minimumTransactions &&
        rate > this.parameters.threshold
      ) {
        hitResult.push({
          direction: 'DESTINATION',
          vars: super.getTransactionVars('destination'),
        })
      }
    }

    return hitResult
  }

  private async getTransactionCounts() {
    let senderTransactionCounts:
      | {
          senderSendingFullCount: number
          senderReceivingFullCount: number
          senderSendingFilteredCount: number
          senderReceivingFilteredCount: number
        }
      | undefined = undefined
    let receiverTransactionCounts:
      | {
          receiverSendingFullCount: number
          receiverReceivingFullCount: number
          receiverSendingFilteredCount: number
          receiverReceivingFilteredCount: number
        }
      | undefined = undefined
    let checkSender = this.parameters.checkSender
    let checkReceiver = this.parameters.checkReceiver
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.timeWindow
    )
    const [originAggregationData, destinationAggregationData] =
      await Promise.all([
        this.getRuleAggregations<AggregationData>(
          'origin',
          afterTimestamp,
          beforeTimestamp
        ),
        this.getRuleAggregations<AggregationData>(
          'destination',
          afterTimestamp,
          beforeTimestamp
        ),
      ])

    if (originAggregationData) {
      checkSender = 'none'
      senderTransactionCounts = {
        senderSendingFullCount: _.sumBy(
          originAggregationData,
          (data) => data.allSendingCount || 0
        ),
        senderReceivingFullCount: _.sumBy(
          originAggregationData,
          (data) => data.allReceivingCount || 0
        ),
        senderSendingFilteredCount: _.sumBy(
          originAggregationData,
          (data) => data.filteredSendingCount || 0
        ),
        senderReceivingFilteredCount: _.sumBy(
          originAggregationData,
          (data) => data.filteredReceivingCount || 0
        ),
      }
    }
    if (destinationAggregationData) {
      checkReceiver = 'none'
      receiverTransactionCounts = {
        receiverSendingFullCount: _.sumBy(
          destinationAggregationData,
          (data) => data.allSendingCount || 0
        ),
        receiverReceivingFullCount: _.sumBy(
          destinationAggregationData,
          (data) => data.allReceivingCount || 0
        ),
        receiverSendingFilteredCount: _.sumBy(
          destinationAggregationData,
          (data) => data.filteredSendingCount || 0
        ),
        receiverReceivingFilteredCount: _.sumBy(
          destinationAggregationData,
          (data) => data.filteredReceivingCount || 0
        ),
      }
    }

    const {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkSender,
        checkReceiver,
      },
      ['timestamp']
    )
    const {
      senderSendingTransactions: senderSendingTransactionsFiltered,
      senderReceivingTransactions: senderReceivingTransactionsFiltered,
      receiverSendingTransactions: receiverSendingTransactionsFiltered,
      receiverReceivingTransactions: receiverReceivingTransactionsFiltered,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkSender,
        checkReceiver,
        transactionTypes: this.filters.transactionTypesHistorical,
        transactionStates: this.parameters.transactionStates,
        paymentMethod: this.filters.paymentMethodHistorical,
        countries: this.filters.transactionCountriesHistorical,
      },
      ['timestamp']
    )

    // Update aggregations
    await Promise.all([
      originAggregationData
        ? Promise.resolve()
        : this.refreshRuleAggregations(
            'origin',
            await this.getTimeAggregatedResult(
              senderSendingTransactions,
              senderReceivingTransactions,
              senderSendingTransactionsFiltered,
              senderReceivingTransactionsFiltered
            )
          ),
      destinationAggregationData
        ? Promise.resolve()
        : this.refreshRuleAggregations(
            'destination',
            await this.getTimeAggregatedResult(
              receiverSendingTransactions,
              receiverReceivingTransactions,
              receiverSendingTransactionsFiltered,
              receiverReceivingTransactionsFiltered
            )
          ),
    ])

    return {
      senderSendingFullCount: senderSendingTransactions.length,
      senderReceivingFullCount: senderReceivingTransactions.length,
      senderSendingFilteredCount: senderSendingTransactionsFiltered.length,
      senderReceivingFilteredCount: senderReceivingTransactionsFiltered.length,
      receiverSendingFullCount: receiverSendingTransactions.length,
      receiverReceivingFullCount: receiverReceivingTransactions.length,
      receiverSendingFilteredCount: receiverSendingTransactionsFiltered.length,
      receiverReceivingFilteredCount:
        receiverReceivingTransactionsFiltered.length,
      ...senderTransactionCounts,
      ...receiverTransactionCounts,
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[],
    sendingTransactionsFiltered: AuxiliaryIndexTransaction[],
    receivingTransactionsFiltered: AuxiliaryIndexTransaction[]
  ) {
    return _.merge(
      groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          allSendingCount: group.length,
        })
      ),
      groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          allReceivingCount: group.length,
        })
      ),
      groupTransactionsByHour<AggregationData>(
        sendingTransactionsFiltered,
        async (group) => ({
          filteredSendingCount: group.length,
        })
      ),
      groupTransactionsByHour<AggregationData>(
        receivingTransactionsFiltered,
        async (group) => ({
          filteredReceivingCount: group.length,
        })
      )
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData> {
    const data = {
      ...targetAggregationData,
    }
    if (
      isTransactionFiltered &&
      this.transaction.transactionState &&
      this.parameters.transactionStates.includes(
        this.transaction.transactionState
      )
    ) {
      if (direction === 'origin') {
        data.filteredSendingCount = (data.filteredSendingCount ?? 0) + 1
      } else {
        data.filteredReceivingCount = (data.filteredReceivingCount ?? 0) + 1
      }
    }
    if (direction === 'origin') {
      data.allSendingCount = (data.allSendingCount ?? 0) + 1
    } else {
      data.allReceivingCount = (data.allReceivingCount ?? 0) + 1
    }
    return data
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 1
  }
}
