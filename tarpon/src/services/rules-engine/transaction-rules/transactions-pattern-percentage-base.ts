import { JSONSchemaType } from 'ajv'
import { mergeWith, sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  INITIAL_TRANSACTIONS_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { RuleHitResultItem } from '../rule'
import { TransactionAggregationRule } from './aggregation-rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'

type AggregationData = {
  all?: number
  match?: number
}

export type TransactionsPatternPercentageRuleParameters = {
  patternPercentageLimit: number
  timeWindow: TimeWindow
  initialTransactions: number

  // Optional parameters
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
}

@traceable
export default abstract class TransactionsPatternPercentageBaseRule<
  T extends TransactionsPatternPercentageRuleParameters
> extends TransactionAggregationRule<
  T,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getBaseSchema(): JSONSchemaType<TransactionsPatternPercentageRuleParameters> {
    return {
      type: 'object',
      properties: {
        patternPercentageLimit: {
          type: 'number',
          title: 'Threshold percentage limit',
          minimum: 0,
          maximum: 100,
        },
        initialTransactions: INITIAL_TRANSACTIONS_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['initialTransactions', 'patternPercentageLimit', 'timeWindow'],
    }
  }

  public async computeRule() {
    return await Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return {
      all: (targetAggregationData?.all || 0) + 1,
      match:
        (targetAggregationData?.match || 0) +
        (this.matchPattern(this.transaction, direction) ? 1 : 0),
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const { checkSender, checkReceiver } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    if (!this.matchPattern(this.transaction, direction)) {
      return
    }
    const { allTransactionsCount, matchTransactionsCount } = await this.getData(
      direction
    )
    const matchPercentage =
      (matchTransactionsCount / allTransactionsCount) * 100
    if (
      allTransactionsCount > this.parameters.initialTransactions &&
      matchPercentage > this.parameters.patternPercentageLimit
    ) {
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: super.getTransactionVars(direction),
      }
    }
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.allTransactions,
        data.matchedTransactions
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

  private async getData(direction: 'origin' | 'destination'): Promise<{
    allTransactionsCount: number
    matchTransactionsCount: number
  }> {
    const { timeWindow } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      const allTransactionsCount =
        sumBy(userAggregationData, (data) => data.all || 0) + 1
      const matchTransactionsCount =
        sumBy(userAggregationData, (data) => data.match || 0) + 1
      return {
        allTransactionsCount,
        matchTransactionsCount,
      }
    }

    if (this.shouldUseRawData()) {
      let allTransactionsCount = 1
      let matchTransactionsCount = 1
      for await (const data of this.getRawTransactionsData(direction)) {
        allTransactionsCount += data.allTransactions.length
        matchTransactionsCount += data.matchedTransactions.length
      }
      return {
        allTransactionsCount,
        matchTransactionsCount,
      }
    } else {
      return {
        allTransactionsCount: 1,
        matchTransactionsCount: 1,
      }
    }
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    allTransactions: AuxiliaryIndexTransaction[]
    matchedTransactions: AuxiliaryIndexTransaction[]
  }> {
    const {
      timeWindow,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters

    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow,
        checkDirection: direction === 'origin' ? checkSender : checkReceiver,
        filters: this.filters,
      },
      ['timestamp', ...this.getNeededTransactionFields()]
    )

    for await (const data of generator) {
      const allTransactions = data.sendingTransactions.concat(
        data.receivingTransactions
      )
      const matchedTransactions = [
        ...data.sendingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'origin')
        ),
        ...data.receivingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'destination')
        ),
      ]

      yield { allTransactions, matchedTransactions }
    }
  }

  private async getTimeAggregatedResult(
    allTransactions: AuxiliaryIndexTransaction[],
    matchedTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData>(
        allTransactions,
        async (group) => ({
          all: group.length,
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        matchedTransactions,
        async (group) => ({
          match: group.length,
        }),
        this.getAggregationGranularity()
      )
    )
  }

  protected abstract matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination'
  ): boolean

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>

  override getRuleAggregationVersion(): number {
    return 4
  }
}
