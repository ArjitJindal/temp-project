import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  getTransactionUserPastTransactions,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import { getTimestampRange } from '../utils/time-utils'
import { MissingRuleParameter } from './errors'
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
  TransactionFilters,
  AggregationData
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsExceedPastPeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        timeWindow1: TIME_WINDOW_SCHEMA({
          title: 'Time Period 1',
        }),
        timeWindow2: TIME_WINDOW_SCHEMA({
          title: 'Time Period 2',
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

  protected async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined
  ): Promise<AggregationData> {
    return {
      count: (aggregation?.count || 0) + 1,
    }
  }

  public async computeRule() {
    const {
      checkSender,
      checkReceiver,
      timeWindow1,
      timeWindow2,
      minTransactionsInTimeWindow1,
      multiplierThreshold,
    } = this.parameters

    const {
      afterTimestamp: afterTimestamp1,
      beforeTimestamp: beforeTimestamp1,
    } = getTimestampRange(this.transaction.timestamp!, timeWindow1)
    const { afterTimestamp: afterTimestamp2 } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow2
    )
    const directions: Array<'origin' | 'destination'> = []
    if (checkSender !== 'none') {
      directions.push('origin')
    }
    if (checkReceiver !== 'none') {
      directions.push('destination')
    }

    let missingAggregation = false
    for (const direction of directions) {
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
      if (!userAggregationDataPeriod1 && !userAggregationDataPeriod2) {
        missingAggregation = true
        break
      }
      const transactionsCountP1 =
        _.sumBy(userAggregationDataPeriod1, (data) => data.count || 0) + 1
      const transactionsCountP2 = _.sumBy(
        userAggregationDataPeriod2,
        (data) => data.count || 0
      )

      const hasMinTransactionsInTimeWindow1 =
        !minTransactionsInTimeWindow1 ||
        transactionsCountP1 >= minTransactionsInTimeWindow1
      if (
        hasMinTransactionsInTimeWindow1 &&
        transactionsCountP1 > multiplierThreshold * transactionsCountP2
      ) {
        return {
          action: this.action,
          vars: {
            ...super.getTransactionVars(direction),
          },
        }
      }
    }

    if (missingAggregation) {
      return this.computeRuleExpensive()
    }
  }

  public async computeRuleExpensive() {
    const {
      multiplierThreshold,
      minTransactionsInTimeWindow1,
      timeWindow1,
      timeWindow2,
      checkSender,
      checkReceiver,
    } = this.parameters
    if (multiplierThreshold === undefined) {
      throw new MissingRuleParameter()
    }

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const [transactionsPeriod1, transactionsPeriod2] = await Promise.all([
      getTransactionUserPastTransactions(
        this.transaction,
        this.transactionRepository,
        {
          timeWindow: timeWindow1,
          checkSender: checkSender || 'all',
          checkReceiver: checkReceiver || 'all',
          transactionTypes: this.filters.transactionTypes,
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
          countries: this.filters.transactionCountries,
        },
        ['timestamp']
      ),
      getTransactionUserPastTransactions(
        this.transaction,
        this.transactionRepository,
        {
          timeWindow: timeWindow2,
          checkSender: checkSender || 'all',
          checkReceiver: checkReceiver || 'all',
          transactionTypes: this.filters.transactionTypes,
          transactionState: this.filters.transactionState,
          paymentMethod: this.filters.paymentMethod,
          countries: this.filters.transactionCountries,
        },
        ['timestamp']
      ),
    ])

    const senderTransactionsPeriod1 =
      transactionsPeriod1.senderReceivingTransactions.concat(
        transactionsPeriod1.senderSendingTransactions
      )
    const senderTransactionsPeriod2 =
      transactionsPeriod2.senderReceivingTransactions.concat(
        transactionsPeriod2.senderSendingTransactions
      )
    const receiverTransactionssPeriod1 =
      transactionsPeriod1.receiverReceivingTransactions.concat(
        transactionsPeriod1.receiverSendingTransactions
      )
    const receiverTransactionsPeriod2 =
      transactionsPeriod2.receiverReceivingTransactions.concat(
        transactionsPeriod2.receiverSendingTransactions
      )

    // Update aggregations
    await Promise.all([
      checkSender !== 'none'
        ? this.refreshRuleAggregations(
            'origin',
            await this.getTimeAggregatedResult(senderTransactionsPeriod2)
          )
        : Promise.resolve(),
      this.parameters.checkReceiver !== 'none'
        ? this.refreshRuleAggregations(
            'destination',
            await this.getTimeAggregatedResult(receiverTransactionsPeriod2)
          )
        : Promise.resolve(),
    ])

    const senderTransactionsCount1 = senderTransactionsPeriod1.length + 1
    const senderTransactionsCount2 = senderTransactionsPeriod2.length + 1
    const receiverTransactionsCount1 = receiverTransactionssPeriod1.length + 1
    const receiverTransactionsCount2 = receiverTransactionsPeriod2.length + 1

    if (
      checkSender !== 'none' &&
      (!minTransactionsInTimeWindow1 ||
        senderTransactionsCount1 >= minTransactionsInTimeWindow1) &&
      senderTransactionsCount2 - senderTransactionsCount1 > 0 &&
      senderTransactionsCount1 >
        multiplierThreshold *
          (senderTransactionsCount2 - senderTransactionsCount1)
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
        },
      }
    }
    if (
      checkReceiver !== 'none' &&
      (!minTransactionsInTimeWindow1 ||
        receiverTransactionsCount1 >= minTransactionsInTimeWindow1) &&
      receiverTransactionsCount2 - receiverTransactionsCount1 > 0 &&
      receiverTransactionsCount1 >
        multiplierThreshold *
          (receiverTransactionsCount2 - receiverTransactionsCount1)
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('destination'),
        },
      }
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

  protected getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow2
  }
}
