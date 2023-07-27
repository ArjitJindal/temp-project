import { JSONSchemaType } from 'ajv'
import { sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
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
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    return {
      all: (targetAggregationData?.all || 0) + 1,
      match:
        (targetAggregationData?.all || 0) +
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

  private async getData(direction: 'origin' | 'destination'): Promise<{
    allTransactionsCount: number
    matchTransactionsCount: number
  }> {
    const {
      timeWindow,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
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
    // Fallback
    const { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
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

    const allTransactions = sendingTransactions.concat(receivingTransactions)
    const matchedTransactions = [
      ...sendingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'origin')
      ),
      ...receivingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'destination')
      ),
    ]

    // Update aggregations
    await this.rebuildRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(allTransactions, matchedTransactions)
    )

    return {
      allTransactionsCount: allTransactions.length + 1,
      matchTransactionsCount: matchedTransactions.length + 1,
    }
  }

  private async getTimeAggregatedResult(
    allTransactions: AuxiliaryIndexTransaction[],
    matchedTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        allTransactions,
        async (group) => ({
          all: group.length,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        matchedTransactions,
        async (group) => ({
          match: group.length,
        })
      )
    )
  }

  protected abstract matchPattern(
    _transaction: AuxiliaryIndexTransaction,
    _direction?: 'origin' | 'destination'
  ): boolean

  protected abstract getNeededTransactionFields(): Array<keyof Transaction>

  override getRuleAggregationVersion(): number {
    return 2
  }
}
