import { JSONSchemaType } from 'ajv'
import mergeWith from 'lodash/mergeWith'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
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

export type AggregationData<T> = {
  sendingCount?: T
  receivingCount?: T
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
  T extends TransactionsPatternVelocityRuleParameters,
  AggregationDataValue = number
> extends TransactionAggregationRule<
  T,
  TransactionHistoricalFilters,
  AggregationData<AggregationDataValue>
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
    return {
      ruleHitResult: (
        await Promise.all([
          this.computeRuleUser('origin'),
          this.computeRuleUser('destination'),
        ])
      )
        .filter(Boolean)
        .flat(),
    }
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver'
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

    const count = await this.getData(direction)
    if (
      (!this.parameters.initialTransactions ||
        count > this.parameters.initialTransactions) &&
      count > this.parameters.transactionsLimit
    ) {
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: super.getTransactionVars(direction),
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

  private async getData(direction: 'origin' | 'destination'): Promise<number> {
    const {
      timeWindow,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    const userType = direction === 'origin' ? 'sender' : 'receiver'
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<
      AggregationData<AggregationDataValue>
    >(direction, afterTimestamp, beforeTimestamp)
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    let aggData = (await this.getAggregationData(
      [this.transaction].filter((transaction) =>
        this.matchPattern(transaction, direction, userType)
      ),
      direction
    )) as AggregationDataValue
    if (userAggregationData) {
      const transactionsCount = this.aggregate([
        ...(checkDirection !== 'receiving'
          ? userAggregationData.map((v) => v.sendingCount)
          : []),
        ...(checkDirection !== 'sending'
          ? userAggregationData.map((v) => v.receivingCount)
          : []),
        aggData,
      ])
      return this.reduce(transactionsCount, this.transaction)
    }

    if (!this.shouldUseRawData() && this.isAggregationSupported()) {
      return this.reduce(aggData, this.transaction)
    } else {
      for await (const data of this.getRawTransactionsData(direction)) {
        const partialAggData = await this.getAggregationData(
          [
            ...data.sendingTransactions.filter((transaction) =>
              this.matchPattern(transaction, 'origin', userType)
            ),
            ...data.receivingTransactions.filter((transaction) =>
              this.matchPattern(transaction, 'destination', userType)
            ),
          ],
          direction
        )
        aggData = this.merge(aggData, partialAggData)
      }
      return this.reduce(aggData, this.transaction)
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    const matchPattern = this.matchPattern(
      this.transaction,
      direction,
      direction === 'origin' ? 'sender' : 'receiver'
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
    let timeAggregatedResult: {
      [key1: string]: AggregationData<AggregationDataValue>
    } = {}
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
        (
          a: AggregationData<AggregationDataValue>,
          b: AggregationData<AggregationDataValue>
        ) => {
          return mergeWith(
            a,
            b,
            (
              x: AggregationDataValue | undefined,
              y: AggregationDataValue | undefined
            ) => this.merge(x, y)
          )
        }
      )
    }

    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  protected abstract getAggregationData(
    transactions: AuxiliaryIndexTransaction[],
    direction: 'origin' | 'destination'
  ): Promise<AggregationDataValue>

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData<AggregationDataValue>>(
        sendingTransactions,
        async (group) => ({
          sendingCount: await this.getAggregationData(group, 'origin'),
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData<AggregationDataValue>>(
        receivingTransactions,
        async (group) => ({
          receivingCount: await this.getAggregationData(group, 'destination'),
        }),
        this.getAggregationGranularity()
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
    _userType?: 'sender' | 'receiver'
  ): boolean

  private aggregate(
    aggValues: Array<AggregationDataValue | undefined>
  ): AggregationDataValue {
    return (
      aggValues.reduce((acc, value) => {
        if (!value) {
          return acc
        }
        return this.merge(acc, value)
      }, this.getInitialAggregationDataValue() as AggregationDataValue) ??
      ({} as AggregationDataValue)
    )
  }

  protected abstract merge(
    aggValue1: AggregationDataValue | undefined,
    aggValue2: AggregationDataValue | undefined
  ): AggregationDataValue

  protected abstract reduce(
    aggValue: AggregationDataValue | undefined,
    transaction: AuxiliaryIndexTransaction
  ): number

  protected abstract getInitialAggregationDataValue(): AggregationDataValue

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>

  protected abstract isAggregationSupported(): boolean

  protected abstract isMatchPaymentMethodDetailsEnabled(
    direction: 'origin' | 'destination'
  ): boolean | undefined

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData<AggregationDataValue> | undefined
  ): Promise<AggregationData<AggregationDataValue> | null> {
    const aggData = (await this.getAggregationData(
      [this.transaction],
      direction
    )) as AggregationDataValue
    if (direction === 'origin') {
      return {
        ...targetAggregationData,
        sendingCount: this.merge(targetAggregationData?.sendingCount, aggData),
      }
    } else {
      return {
        ...targetAggregationData,
        receivingCount: this.merge(
          targetAggregationData?.receivingCount,
          aggData
        ),
      }
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 4
  }
}
