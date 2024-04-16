import { JSONSchemaType } from 'ajv'
import { mergeWith, sumBy } from 'lodash'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '../utils/rule-parameter-schemas'
import { RuleHitResultItem } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { getNonUserReceiverKeys, getNonUserSenderKeys } from '../utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionAggregationRule } from './aggregation-rule'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'

type AggregationData = {
  sendingCount?: number
  receivingCount?: number
}

export type SamePaymentDetailsParameters = {
  timeWindow: TimeWindow
  threshold: number
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

@traceable
export default class SamePaymentDetailsRule extends TransactionAggregationRule<
  SamePaymentDetailsParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<SamePaymentDetailsParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        threshold: {
          type: 'number',
          title:
            'Number of times payment details need to be used to trigger the rule',
          description:
            'Rule is run when the number of same payment details used is greater or equal to threshold',
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
      },
      required: ['timeWindow', 'threshold'],
    }
  }

  public async computeRule() {
    return await Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    if (direction === 'origin' && this.parameters.checkSender === 'none') {
      return
    } else if (
      direction === 'destination' &&
      this.parameters.checkReceiver === 'none'
    ) {
      return
    }

    const transactionsCount = (await this.getData(direction)) + 1
    if (transactionsCount >= this.parameters.threshold) {
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          numberOfUses: transactionsCount,
        },
      }
    }
  }

  private async getData(direction: 'origin' | 'destination'): Promise<number> {
    const { timeWindow, checkReceiver, checkSender } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      const transactionsCount = sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingCount
            : checkDirection === 'receiving'
            ? data.receivingCount
            : (data.sendingCount ?? 0) + (data.receivingCount ?? 0)) ?? 0
      )
      return transactionsCount
    }

    if (this.shouldUseRawData()) {
      let transactionsCount = 0
      for await (const data of this.getRawTransactionsData(direction)) {
        transactionsCount +=
          data.sendingTransactions.length + data.receivingTransactions.length
      }
      return transactionsCount
    } else {
      return 0
    }
  }
  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions
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

  private async *getRawTransactionsData(direction: 'origin' | 'destination') {
    const { timeWindow, checkReceiver, checkSender } = this.parameters
    yield* getTransactionUserPastTransactionsByDirectionGenerator(
      {
        ...this.transaction,
        originUserId: undefined, // to force search by payment details
        destinationUserId: undefined,
      },
      direction,
      this.transactionRepository,
      {
        timeWindow,
        checkDirection:
          (direction === 'origin' ? checkSender : checkReceiver) ?? 'all',
        filters: this.filters,
      },
      ['timestamp']
    )
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          receivingCount: group.length,
        })
      )
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const result = targetAggregationData ?? {}
    if (direction === 'origin') {
      result.sendingCount = (result.sendingCount ?? 0) + 1
    } else {
      result.receivingCount = (result.receivingCount ?? 0) + 1
    }
    return result
  }

  override getUserKeyId(direction: 'origin' | 'destination') {
    return direction === 'origin'
      ? getNonUserSenderKeys(this.tenantId, this.transaction, undefined, true)
          ?.PartitionKeyID
      : getNonUserReceiverKeys(this.tenantId, this.transaction, undefined, true)
          ?.PartitionKeyID
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  override getRuleAggregationVersion(): number {
    return 3
  }
}
