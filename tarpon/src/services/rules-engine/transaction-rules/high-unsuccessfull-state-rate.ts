import { JSONSchemaType } from 'ajv'

import { sumBy } from 'lodash'
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
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionAggregationRule } from './aggregation-rule'
import {
  getTransactionUserPastTransactions,
  groupTransactionsByHour,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { mergeObjects } from '@/utils/object'

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
          description:
            'Rule is run when the rate of transactions of specified state are greater than threshold',
          nullable: false,
        },
        minimumTransactions: {
          type: 'number',
          title: 'Number of transactions for the rule start working per user',
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

  private async getRawTransactionsData(
    checkSender: 'sending' | 'all' | 'none' = this.parameters.checkSender,
    checkReceiver: 'receiving' | 'all' | 'none' = this.parameters.checkReceiver
  ) {
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
        filters: {},
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
        filters: this.filters,
      },
      ['timestamp']
    )

    return {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
      senderSendingTransactionsFiltered,
      senderReceivingTransactionsFiltered,
      receiverSendingTransactionsFiltered,
      receiverReceivingTransactionsFiltered,
    }
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
        senderSendingFullCount: sumBy(
          originAggregationData,
          (data) => data.allSendingCount || 0
        ),
        senderReceivingFullCount: sumBy(
          originAggregationData,
          (data) => data.allReceivingCount || 0
        ),
        senderSendingFilteredCount: sumBy(
          originAggregationData,
          (data) => data.filteredSendingCount || 0
        ),
        senderReceivingFilteredCount: sumBy(
          originAggregationData,
          (data) => data.filteredReceivingCount || 0
        ),
      }
    }
    if (destinationAggregationData) {
      checkReceiver = 'none'
      receiverTransactionCounts = {
        receiverSendingFullCount: sumBy(
          destinationAggregationData,
          (data) => data.allSendingCount || 0
        ),
        receiverReceivingFullCount: sumBy(
          destinationAggregationData,
          (data) => data.allReceivingCount || 0
        ),
        receiverSendingFilteredCount: sumBy(
          destinationAggregationData,
          (data) => data.filteredSendingCount || 0
        ),
        receiverReceivingFilteredCount: sumBy(
          destinationAggregationData,
          (data) => data.filteredReceivingCount || 0
        ),
      }
    }

    if (this.shouldUseRawData()) {
      const {
        senderSendingTransactions,
        senderReceivingTransactions,
        receiverSendingTransactions,
        receiverReceivingTransactions,
        senderSendingTransactionsFiltered,
        senderReceivingTransactionsFiltered,
        receiverSendingTransactionsFiltered,
        receiverReceivingTransactionsFiltered,
      } = await this.getRawTransactionsData(checkSender, checkReceiver)

      // Update aggregations
      await Promise.all([
        originAggregationData
          ? Promise.resolve()
          : this.saveRebuiltRuleAggregations(
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
          : this.saveRebuiltRuleAggregations(
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
        senderReceivingFilteredCount:
          senderReceivingTransactionsFiltered.length,
        receiverSendingFullCount: receiverSendingTransactions.length,
        receiverReceivingFullCount: receiverReceivingTransactions.length,
        receiverSendingFilteredCount:
          receiverSendingTransactionsFiltered.length,
        receiverReceivingFilteredCount:
          receiverReceivingTransactionsFiltered.length,
        ...senderTransactionCounts,
        ...receiverTransactionCounts,
      }
    } else {
      return {
        senderSendingFullCount: 0,
        senderReceivingFullCount: 0,
        senderSendingFilteredCount: 0,
        senderReceivingFilteredCount: 0,
        receiverSendingFullCount: 0,
        receiverReceivingFullCount: 0,
        receiverSendingFilteredCount: 0,
        receiverReceivingFilteredCount: 0,
        ...senderTransactionCounts,
        ...receiverTransactionCounts,
      }
    }
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    _isTransactionHistoricalFiltered: boolean
  ): boolean {
    return true
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ) {
    if (direction === 'origin') {
      const {
        senderSendingTransactions,
        senderReceivingTransactions,
        senderSendingTransactionsFiltered,
        senderReceivingTransactionsFiltered,
      } = await this.getRawTransactionsData(this.parameters.checkSender, 'none')
      if (isTransactionHistoricalFiltered) {
        senderSendingTransactionsFiltered.push(this.transaction)
      }
      senderSendingTransactions.push(this.transaction)
      await this.saveRebuiltRuleAggregations(
        direction,
        await this.getTimeAggregatedResult(
          senderSendingTransactions,
          senderReceivingTransactions,
          senderSendingTransactionsFiltered,
          senderReceivingTransactionsFiltered
        )
      )
    } else {
      const {
        receiverSendingTransactions,
        receiverReceivingTransactions,
        receiverSendingTransactionsFiltered,
        receiverReceivingTransactionsFiltered,
      } = await this.getRawTransactionsData(
        'none',
        this.parameters.checkReceiver
      )
      if (isTransactionHistoricalFiltered) {
        receiverReceivingTransactionsFiltered.push(this.transaction)
      }
      receiverReceivingTransactions.push(this.transaction)
      await this.saveRebuiltRuleAggregations(
        direction,
        await this.getTimeAggregatedResult(
          receiverSendingTransactions,
          receiverReceivingTransactions,
          receiverSendingTransactionsFiltered,
          receiverReceivingTransactionsFiltered
        )
      )
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[],
    sendingTransactionsFiltered: AuxiliaryIndexTransaction[],
    receivingTransactionsFiltered: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          allSendingCount: group.length,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          allReceivingCount: group.length,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        sendingTransactionsFiltered,
        async (group) => ({
          filteredSendingCount: group.length,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
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
    isTransactionHistoricalFiltered: boolean
  ): Promise<AggregationData> {
    const data = {
      ...targetAggregationData,
    }
    if (
      isTransactionHistoricalFiltered &&
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
    return 3
  }
}
