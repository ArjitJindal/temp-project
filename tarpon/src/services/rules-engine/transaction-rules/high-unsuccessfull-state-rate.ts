import { JSONSchemaType } from 'ajv'

import mergeWith from 'lodash/mergeWith'
import sumBy from 'lodash/sumBy'
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
  getTransactionUserPastTransactionsGenerator,
  groupTransactionsByTime,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { mergeObjects } from '@/utils/object'
import { zipGenerators } from '@/utils/generator'
import { traceable } from '@/core/xray'

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

@traceable
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
      this.transaction.transactionState &&
      !this.parameters.transactionStates.includes(
        this.transaction.transactionState
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

    return {
      ruleHitResult: hitResult,
    }
  }

  private async *getRawTransactionsData(
    checkSender: 'sending' | 'all' | 'none' = this.parameters.checkSender,
    checkReceiver: 'receiving' | 'all' | 'none' = this.parameters.checkReceiver
  ) {
    const generatorAll = getTransactionUserPastTransactionsGenerator(
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
    const generatorFiltered = getTransactionUserPastTransactionsGenerator(
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

    for await (const data of zipGenerators(generatorAll, generatorFiltered, {
      senderSendingTransactions: [],
      senderReceivingTransactions: [],
      receiverSendingTransactions: [],
      receiverReceivingTransactions: [],
    })) {
      yield {
        senderSendingTransactions: data[0].senderSendingTransactions,
        senderReceivingTransactions: data[0].senderReceivingTransactions,
        receiverSendingTransactions: data[0].receiverSendingTransactions,
        receiverReceivingTransactions: data[0].receiverReceivingTransactions,
        senderSendingTransactionsFiltered: data[1].senderSendingTransactions,
        senderReceivingTransactionsFiltered:
          data[1].senderReceivingTransactions,
        receiverSendingTransactionsFiltered:
          data[1].receiverSendingTransactions,
        receiverReceivingTransactionsFiltered:
          data[1].receiverReceivingTransactions,
      }
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
      this.transaction.timestamp ?? 0,
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
      let senderSendingFullCount = 0
      let senderReceivingFullCount = 0
      let senderSendingFilteredCount = 0
      let senderReceivingFilteredCount = 0
      let receiverSendingFullCount = 0
      let receiverReceivingFullCount = 0
      let receiverSendingFilteredCount = 0
      let receiverReceivingFilteredCount = 0
      for await (const data of this.getRawTransactionsData(
        checkSender,
        checkReceiver
      )) {
        senderSendingFullCount += data.senderSendingTransactions.length
        senderReceivingFullCount += data.senderReceivingTransactions.length
        senderSendingFilteredCount +=
          data.senderSendingTransactionsFiltered.length
        senderReceivingFilteredCount +=
          data.senderReceivingTransactionsFiltered.length
        receiverSendingFullCount += data.receiverSendingTransactions.length
        receiverReceivingFullCount += data.receiverReceivingTransactions.length
        receiverSendingFilteredCount +=
          data.receiverSendingTransactionsFiltered.length
        receiverReceivingFilteredCount +=
          data.receiverReceivingTransactionsFiltered.length
      }

      return {
        senderSendingFullCount,
        senderReceivingFullCount,
        senderSendingFilteredCount,
        senderReceivingFilteredCount,
        receiverSendingFullCount,
        receiverReceivingFullCount,
        receiverSendingFilteredCount,
        receiverReceivingFilteredCount,
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

  public async rebuildUserAggregation(direction: 'origin' | 'destination') {
    if (direction === 'origin') {
      let timeAggregatedResult: { [key1: string]: AggregationData } = {}
      for await (const data of await this.getRawTransactionsData(
        this.parameters.checkSender,
        'none'
      )) {
        const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
          data.senderSendingTransactions,
          data.senderReceivingTransactions,
          data.senderSendingTransactionsFiltered,
          data.senderReceivingTransactionsFiltered
        )
        timeAggregatedResult = mergeWith(
          timeAggregatedResult,
          partialTimeAggregatedResult,
          (a: AggregationData, b: AggregationData) => {
            return mergeWith(
              a,
              b,
              (x: number | undefined, y: number | undefined) =>
                (x ?? 0) + (y ?? 0)
            )
          }
        )
      }
      await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
    } else {
      let timeAggregatedResult: { [key1: string]: AggregationData } = {}
      for await (const data of await this.getRawTransactionsData(
        'none',
        this.parameters.checkReceiver
      )) {
        const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
          data.receiverSendingTransactions,
          data.receiverReceivingTransactions,
          data.receiverSendingTransactionsFiltered,
          data.receiverReceivingTransactionsFiltered
        )
        timeAggregatedResult = mergeWith(
          timeAggregatedResult,
          partialTimeAggregatedResult,
          (a: AggregationData, b: AggregationData) => {
            return mergeWith(
              a,
              b,
              (x: number | undefined, y: number | undefined) =>
                (x ?? 0) + (y ?? 0)
            )
          }
        )
      }
      await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[],
    sendingTransactionsFiltered: AuxiliaryIndexTransaction[],
    receivingTransactionsFiltered: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData>(
        sendingTransactions,
        async (group) => ({
          allSendingCount: group.length,
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        receivingTransactions,
        async (group) => ({
          allReceivingCount: group.length,
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        sendingTransactionsFiltered,
        async (group) => ({
          filteredSendingCount: group.length,
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        receivingTransactionsFiltered,
        async (group) => ({
          filteredReceivingCount: group.length,
        }),
        this.getAggregationGranularity()
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
