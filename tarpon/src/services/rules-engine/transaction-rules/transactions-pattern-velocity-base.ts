import { JSONSchemaType } from 'ajv'
import { mapValues, sumBy, groupBy, mergeWith } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'

const DEFAULT_GROUP_KEY = 'all'

type AggregationData = {
  sendingCount?: number
  receivingCount?: number
}

export type TransactionsPatternVelocityRuleParameters = {
  transactionsLimit: number
  timeWindow: TimeWindow

  // Optional parameters
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
  initialTransactions?: number
}

@traceable
export default abstract class TransactionsPatternVelocityBaseRule<
  T extends TransactionsPatternVelocityRuleParameters
> extends TransactionAggregationRule<
  T,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getBaseSchema(): JSONSchemaType<TransactionsPatternVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['transactionsLimit', 'timeWindow'],
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
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver',
      true
    )
    if (!matchPattern) {
      return
    }
    const { checkSender, checkReceiver } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    const groupCounts = await this.getData(direction)
    for (const group in groupCounts) {
      if (
        (!this.parameters.initialTransactions ||
          groupCounts[group] > this.parameters.initialTransactions) &&
        groupCounts[group] > this.parameters.transactionsLimit
      ) {
        return {
          direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
          vars: super.getTransactionVars(direction),
        }
      }
    }
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const {
      timeWindow,
      checkReceiver = 'all',
      checkSender = 'all',
    } = this.parameters
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver

    yield* getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow,
        checkDirection,
        matchPaymentMethodDetails:
          this.isMatchPaymentMethodDetailsEnabled(direction),
        filters: this.filters,
      },
      this.getNeededTransactionFields()
    )
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<{ [groupKey: string]: number }> {
    const {
      timeWindow,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
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
      return {
        [DEFAULT_GROUP_KEY]: transactionsCount + 1,
      }
    }

    const userType = direction === 'origin' ? 'sender' : 'receiver'
    let patternCount = await this.getAggregationData(
      [this.transaction].filter((transaction) =>
        this.matchPattern(transaction, direction, userType)
      )
    )
    if (!this.shouldUseRawData() && this.isAggregationSupported()) {
      return patternCount
    } else {
      for await (const data of this.getRawTransactionsData(direction)) {
        const partialPatternCount = await this.getAggregationData([
          ...data.sendingTransactions.filter((transaction) =>
            this.matchPattern(transaction, 'origin', userType)
          ),
          ...data.receivingTransactions.filter((transaction) =>
            this.matchPattern(transaction, 'destination', userType)
          ),
        ])
        patternCount = mergeWith(
          patternCount,
          partialPatternCount,
          (x: number | undefined, y: number | undefined) => (x ?? 0) + (y ?? 0)
        )
      }
      return patternCount
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver',
      true
    )
    return (
      isTransactionHistoricalFiltered &&
      matchPattern &&
      this.isAggregationSupported()
    )
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    const userType = direction === 'origin' ? 'sender' : 'receiver'
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'origin', userType)
        ),
        data.receivingTransactions.filter((transaction) =>
          this.matchPattern(transaction, 'destination', userType)
        )
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

  private async getAggregationData(
    transactions: AuxiliaryIndexTransaction[]
  ): Promise<AggregationData> {
    return mapValues(
      groupBy(
        transactions,
        (t) => this.getTransactionGroupKey(t) || DEFAULT_GROUP_KEY
      ),
      (group) => group.length
    )
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({ sendingCount: group.length })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({ receivingCount: group.length })
      )
    )
  }

  protected getTransactionGroupKey(
    _transaction: AuxiliaryIndexTransaction
  ): string | undefined {
    return
  }

  protected abstract matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination',
    _userType?: 'sender' | 'receiver',
    _pure?: boolean
  ): boolean

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>

  protected abstract isAggregationSupported(): boolean

  protected abstract isMatchPaymentMethodDetailsEnabled(
    direction: 'origin' | 'destination'
  ): boolean | undefined

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    if (direction === 'origin') {
      return {
        ...targetAggregationData,
        sendingCount: (targetAggregationData?.sendingCount || 0) + 1,
      }
    } else {
      return {
        ...targetAggregationData,
        receivingCount: (targetAggregationData?.receivingCount || 0) + 1,
      }
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 3
  }
}
