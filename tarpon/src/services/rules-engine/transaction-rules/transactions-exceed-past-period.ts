import { JSONSchemaType } from 'ajv'
import { mergeWith, sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
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
import { zipGenerators } from '@/utils/generator'
import { traceable } from '@/core/xray'

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

@traceable
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
    aggregation: AggregationData | undefined
  ): Promise<AggregationData | null> {
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
    } = getTimestampRange(this.transaction.timestamp, timeWindow1)
    const { afterTimestamp: afterTimestamp2 } = getTimestampRange(
      this.transaction.timestamp,
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

    if (this.shouldUseRawData()) {
      let transactionsCountP1 = 1
      let transactionsCountP2 = 1
      for await (const data of this.getRawTransactionsData(direction)) {
        transactionsCountP1 += data.transactionsPeriod1.length
        transactionsCountP2 += data.transactionsPeriod2.length
      }
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

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    transactionsPeriod1: AuxiliaryIndexTransaction[]
    transactionsPeriod2: AuxiliaryIndexTransaction[]
  }> {
    const { checkSender, checkReceiver, timeWindow1, timeWindow2 } =
      this.parameters

    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const generatorPeriod1 =
      getTransactionUserPastTransactionsByDirectionGenerator(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: timeWindow1,
          checkDirection: checkDirection ?? 'all',
          filters: this.filters,
        },
        ['timestamp']
      )
    const generatorPeriod2 =
      getTransactionUserPastTransactionsByDirectionGenerator(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: timeWindow2,
          checkDirection: checkDirection ?? 'all',
          filters: this.filters,
        },
        ['timestamp']
      )

    for await (const data of zipGenerators(generatorPeriod1, generatorPeriod2, {
      sendingTransactions: [],
      receivingTransactions: [],
    })) {
      yield {
        transactionsPeriod1: data[0].sendingTransactions.concat(
          data[0].receivingTransactions
        ),
        transactionsPeriod2: data[1].sendingTransactions.concat(
          data[1].receivingTransactions
        ),
      }
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
        data.transactionsPeriod2
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
