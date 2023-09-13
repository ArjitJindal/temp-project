import { JSONSchemaType } from 'ajv'
import { sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { RuleHitResultItem } from '../rule'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { TransactionAggregationRule } from './aggregation-rule'

type AggregationData = {
  count?: number
}

export type TransactionsExceedPastPeriodRuleParameters = {
  minTransactionsInTimeWindow1?: number
  minTransactionsInTimeWindow2?: number
  multiplierThreshold: number
  timeWindow1: TimeWindow
  timeWindow2: TimeWindow

  initialTransactions?: number
  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'
}

export default class TransactionsExceedPastPeriodRule extends TransactionAggregationRule<
  TransactionsExceedPastPeriodRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TransactionsExceedPastPeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow1: TIME_WINDOW_SCHEMA({
          title: 'Time period 1',
        }),
        timeWindow2: TIME_WINDOW_SCHEMA({
          title: 'Time period 2',
          description:
            'Should be larger than time period 1. Time period 1 is excluded',
        }),
        multiplierThreshold: {
          type: 'integer',
          title: 'Multiplier threshold',
          description:
            'Rule is run when the number of transactions of time period 1 is greater than the number of transactions of time period 2 multiplied by this threshold',
        },
        minTransactionsInTimeWindow1: {
          type: 'integer',
          title: 'Minimum number of transactions in time period 1',
          nullable: true,
        },
        minTransactionsInTimeWindow2: {
          type: 'integer',
          title:
            'Minimum number of transactions in time period 2 (time period 1 is excluded)',
          nullable: true,
        },
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
      },
      required: ['multiplierThreshold', 'timeWindow1', 'timeWindow2'],
    }
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    return {
      count: (aggregation?.count || 0) + 1,
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
    const { checkSender, checkReceiver } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    const { transactionsCountP1, transactionsCountP2, totalTransactionCount } =
      await this.getData(direction)
    const hasMinTransactionsInTimeWindow1 =
      !this.parameters.minTransactionsInTimeWindow1 ||
      transactionsCountP1 >= this.parameters.minTransactionsInTimeWindow1
    const hasMinTransactionsInTimeWindow2 =
      !this.parameters.minTransactionsInTimeWindow2 ||
      transactionsCountP2 >= this.parameters.minTransactionsInTimeWindow2
    const hasInitialTransactions = this.parameters.initialTransactions
      ? totalTransactionCount >= this.parameters.initialTransactions
      : true

    if (
      hasMinTransactionsInTimeWindow1 &&
      hasMinTransactionsInTimeWindow2 &&
      hasInitialTransactions &&
      transactionsCountP1 >
        this.parameters.multiplierThreshold * transactionsCountP2
    ) {
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
        },
      }
    }
  }

  private async getData(direction: 'origin' | 'destination'): Promise<{
    transactionsCountP1: number
    transactionsCountP2: number
    totalTransactionCount: number
  }> {
    const { timeWindow1, timeWindow2 } = this.parameters

    const {
      afterTimestamp: afterTimestamp1,
      beforeTimestamp: beforeTimestamp1,
    } = getTimestampRange(this.transaction.timestamp!, timeWindow1)
    const { afterTimestamp: afterTimestamp2 } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow2
    )
    const [
      userAggregationDataPeriod1,
      userAggregationDataPeriod2,
      userTransactionCount,
    ] = await Promise.all([
      this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestamp1,
        beforeTimestamp1
      ),
      this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestamp2,
        afterTimestamp1
      ),
      this.getUserTransactionCount(direction),
    ])

    if (userAggregationDataPeriod1 && userAggregationDataPeriod2) {
      const transactionsCountP1 =
        sumBy(userAggregationDataPeriod1, (data) => data.count || 0) + 1
      const transactionsCountP2 = sumBy(
        userAggregationDataPeriod2,
        (data) => data.count || 0
      )
      return {
        transactionsCountP1,
        transactionsCountP2,
        totalTransactionCount: userTransactionCount,
      }
    }

    // Fallback
    if (this.shouldUseRawData()) {
      const {
        transactionsPeriod1: allTransactionsPeriod1,
        transactionsPeriod2: allTransactionsPeriod2,
      } = await this.getRawTransactionsData(direction)

      // Update aggregations
      await this.saveRebuiltRuleAggregations(
        direction,
        await this.getTimeAggregatedResult(allTransactionsPeriod2)
      )
      const transactionsCountP1 = allTransactionsPeriod1.length + 1
      const transactionsCountP2 = allTransactionsPeriod2.length + 1
      return {
        transactionsCountP1: transactionsCountP1,
        transactionsCountP2: transactionsCountP2 - transactionsCountP1,
        totalTransactionCount: userTransactionCount,
      }
    } else {
      return {
        transactionsCountP1: 1,
        transactionsCountP2: 0,
        totalTransactionCount: userTransactionCount,
      }
    }
  }

  private async getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): Promise<{
    transactionsPeriod1: AuxiliaryIndexTransaction[]
    transactionsPeriod2: AuxiliaryIndexTransaction[]
  }> {
    const { checkSender, checkReceiver, timeWindow1, timeWindow2 } =
      this.parameters

    const checkDirection = direction === 'origin' ? checkSender : checkReceiver

    const [transactionsPeriod1, transactionsPeriod2] = await Promise.all([
      getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: timeWindow1,
          checkDirection: checkDirection ?? 'all',
          filters: this.filters,
        },
        ['timestamp']
      ),
      getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: timeWindow2,
          checkDirection: checkDirection ?? 'all',
          filters: this.filters,
        },
        ['timestamp']
      ),
    ])

    return {
      transactionsPeriod1: transactionsPeriod1.sendingTransactions.concat(
        transactionsPeriod1.receivingTransactions
      ),
      transactionsPeriod2: transactionsPeriod2.sendingTransactions.concat(
        transactionsPeriod2.receivingTransactions
      ),
    }
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): Promise<void> {
    if (!isTransactionFiltered) {
      return
    }

    const { transactionsPeriod2 } = await this.getRawTransactionsData(direction)

    transactionsPeriod2.push(this.transaction)

    // Update aggregations
    await this.saveRebuiltRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(transactionsPeriod2)
    )
  }

  private async getUserTransactionCount(
    direction: 'origin' | 'destination'
  ): Promise<number> {
    const userId =
      direction === 'origin'
        ? this.transaction.originUserId
        : this.transaction.destinationUserId
    if (!userId) {
      return 0
    }
    if (this.aggregationRepository) {
      const counts = await this.aggregationRepository.getUserTransactionsCount(
        userId
      )
      return (
        counts.receivingTransactionsCount + counts.sendingTransactionsCount + 1
      )
    }
    const transactionRepository = this
      .transactionRepository as MongoDbTransactionRepository
    const [sendingTransactionsCount, receivingTransactionsCount] =
      await Promise.all([
        transactionRepository.getTransactionsCount({
          filterOriginUserId: userId,
        }),
        transactionRepository.getTransactionsCount({
          filterDestinationUserId: userId,
        }),
      ])
    return sendingTransactionsCount + receivingTransactionsCount + 1
  }

  private async getTimeAggregatedResult(
    transactions: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
      transactions,
      async (group) => ({
        count: group.length,
      })
    )
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow2
  }

  override getRuleAggregationVersion(): number {
    return 2
  }
}
