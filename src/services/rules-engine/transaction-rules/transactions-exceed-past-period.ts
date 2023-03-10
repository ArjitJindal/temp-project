import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { RuleHitResultItem } from '../rule'
import { TransactionAggregationRule } from './aggregation-rule'

type AggregationData = {
  count?: number
}

export type TransactionsExceedPastPeriodRuleParameters = {
  minTransactionsInTimeWindow1?: number
  multiplierThreshold: number
  timeWindow1: TimeWindow
  timeWindow2: TimeWindow

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
            'rule is run when the number of transactions of time period 2 is greater than the number of transactions of time period 1 multiplied by this threshold',
        },
        minTransactionsInTimeWindow1: {
          type: 'integer',
          title: 'Minimum number of transactions in time period 1',
          nullable: true,
        },
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
    const { transactionsCountP1, transactionsCountP2 } = await this.getData(
      direction
    )
    const hasMinTransactionsInTimeWindow1 =
      !this.parameters.minTransactionsInTimeWindow1 ||
      transactionsCountP1 >= this.parameters.minTransactionsInTimeWindow1
    if (
      hasMinTransactionsInTimeWindow1 &&
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

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<{ transactionsCountP1: number; transactionsCountP2: number }> {
    const { checkSender, checkReceiver, timeWindow1, timeWindow2 } =
      this.parameters
    const {
      afterTimestamp: afterTimestamp1,
      beforeTimestamp: beforeTimestamp1,
    } = getTimestampRange(this.transaction.timestamp!, timeWindow1)
    const { afterTimestamp: afterTimestamp2 } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow2
    )
    const userAggregationDataPeriod1 =
      await this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestamp1,
        beforeTimestamp1
      )
    const userAggregationDataPeriod2 =
      await this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestamp2,
        afterTimestamp1
      )
    if (userAggregationDataPeriod1 && userAggregationDataPeriod2) {
      const transactionsCountP1 =
        _.sumBy(userAggregationDataPeriod1, (data) => data.count || 0) + 1
      const transactionsCountP2 = _.sumBy(
        userAggregationDataPeriod2,
        (data) => data.count || 0
      )
      return {
        transactionsCountP1,
        transactionsCountP2,
      }
    }

    // Fallback

    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const [transactionsPeriod1, transactionsPeriod2] = await Promise.all([
      getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: timeWindow1,
          checkDirection: checkDirection ?? 'all',
          transactionTypes: this.filters.transactionTypesHistorical,
          transactionStates: this.filters.transactionStatesHistorical,
          paymentMethod: this.filters.paymentMethodHistorical,
          countries: this.filters.transactionCountriesHistorical,
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
          transactionTypes: this.filters.transactionTypesHistorical,
          transactionStates: this.filters.transactionStatesHistorical,
          paymentMethod: this.filters.paymentMethodHistorical,
          countries: this.filters.transactionCountriesHistorical,
        },
        ['timestamp']
      ),
    ])

    const allTransactionsPeriod1 =
      transactionsPeriod1.sendingTransactions.concat(
        transactionsPeriod1.receivingTransactions
      )
    const allTransactionsPeriod2 =
      transactionsPeriod2.sendingTransactions.concat(
        transactionsPeriod2.receivingTransactions
      )

    // Update aggregations
    await this.refreshRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(allTransactionsPeriod2)
    )
    const transactionsCountP1 = allTransactionsPeriod1.length + 1
    const transactionsCountP2 = allTransactionsPeriod2.length + 1
    return {
      transactionsCountP1: transactionsCountP1,
      transactionsCountP2: transactionsCountP2 - transactionsCountP1,
    }
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
    return 1
  }
}
