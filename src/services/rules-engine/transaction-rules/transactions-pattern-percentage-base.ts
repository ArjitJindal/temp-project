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
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  INITIAL_TRANSACTIONS_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { RuleHitResult } from '../rule'
import { TransactionAggregationRule } from './aggregation-rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { logger } from '@/core/logger'

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
  transactionRepository?: TransactionRepository

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
    const originMatchPattern = this.matchPattern(this.transaction, 'origin')
    const destinationMatchPattern = this.matchPattern(
      this.transaction,
      'destination'
    )
    if (!originMatchPattern && !destinationMatchPattern) {
      return
    }

    const {
      checkSender,
      checkReceiver,
      timeWindow,
      initialTransactions,
      patternPercentageLimit,
    } = this.parameters

    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow
    )
    const directions: Array<'origin' | 'destination'> = []
    if (checkSender !== 'none' && originMatchPattern) {
      directions.push('origin')
    }
    if (checkReceiver !== 'none' && destinationMatchPattern) {
      directions.push('destination')
    }

    let missingAggregation = false
    const hitResult: RuleHitResult = []
    for (const direction of directions) {
      const userAggregationData =
        await this.getRuleAggregations<AggregationData>(
          direction,
          afterTimestamp,
          beforeTimestamp
        )
      if (!userAggregationData) {
        missingAggregation = true
        break
      }
      const allTransactionsCount =
        _.sumBy(userAggregationData, (data) => data.all || 0) + 1
      const matchTransactionsCount =
        _.sumBy(userAggregationData, (data) => data.match || 0) + 1
      const userMatchPercentage =
        (matchTransactionsCount / allTransactionsCount) * 100
      if (
        allTransactionsCount > initialTransactions &&
        userMatchPercentage > patternPercentageLimit
      ) {
        hitResult.push({
          direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
          vars: {
            ...super.getTransactionVars(direction),
          },
        })
      }
    }

    if (missingAggregation) {
      return this.computeRuleExpensive(
        originMatchPattern,
        destinationMatchPattern
      )
    } else {
      return hitResult
    }
  }

  protected async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData> {
    return {
      all: (targetAggregationData?.all || 0) + 1,
      match:
        (targetAggregationData?.all || 0) +
        (this.matchPattern(this.transaction, direction) ? 1 : 0),
    }
  }

  protected getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  private async computeRuleExpensive(
    originMatchPattern: boolean,
    destinationMatchPattern: boolean
  ) {
    logger.info('Running expensive path...')

    const {
      timeWindow,
      patternPercentageLimit,
      initialTransactions,
      checkSender = 'all',
      checkReceiver = 'all',
    } = this.parameters
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow,
        checkSender: originMatchPattern ? checkSender : 'none',
        checkReceiver: destinationMatchPattern ? checkReceiver : 'none',
        transactionStates: this.filters.transactionStatesHistorical,
        transactionTypes: this.filters.transactionTypesHistorical,
        paymentMethod: this.filters.paymentMethodHistorical,
        countries: this.filters.transactionCountriesHistorical,
      },
      ['timestamp', ...this.getNeededTransactionFields()]
    )

    const senderTransactions = senderSendingTransactions.concat(
      senderReceivingTransactions
    )
    const senderMatchedTransactions = [
      ...senderSendingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'origin')
      ),
      ...senderReceivingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'destination')
      ),
    ]
    const senderMatchPercentage =
      ((senderMatchedTransactions.length + 1) /
        (senderTransactions.length + 1)) *
      100

    const receiverTransactions = receiverSendingTransactions.concat(
      receiverReceivingTransactions
    )
    const receiverMatchedTransactions = [
      ...receiverSendingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'origin')
      ),
      ...receiverReceivingTransactions.filter((transaction) =>
        this.matchPattern(transaction, 'destination')
      ),
    ]
    const receiverMatchPercentage =
      ((receiverMatchedTransactions.length + 1) /
        (receiverTransactions.length + 1)) *
      100

    // Update aggregations
    await Promise.all([
      this.parameters.checkSender !== 'none'
        ? this.refreshRuleAggregations(
            'origin',
            await this.getTimeAggregatedResult(
              senderTransactions,
              senderMatchedTransactions
            )
          )
        : Promise.resolve(),
      this.parameters.checkReceiver !== 'none'
        ? this.refreshRuleAggregations(
            'destination',
            await this.getTimeAggregatedResult(
              receiverTransactions,
              receiverMatchedTransactions
            )
          )
        : Promise.resolve(),
    ])

    const hitResult: RuleHitResult = []
    if (
      senderTransactions.length + 1 > initialTransactions &&
      senderMatchPercentage > patternPercentageLimit
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
    }

    if (
      destinationMatchPattern &&
      receiverTransactions.length + 1 > initialTransactions &&
      receiverMatchPercentage > patternPercentageLimit
    ) {
      hitResult.push({
        direction: 'DESTINATION',
        vars: super.getTransactionVars('destination'),
      })
    }
    return hitResult
  }

  private async getTimeAggregatedResult(
    allTransactions: AuxiliaryIndexTransaction[],
    matchedTransactions: AuxiliaryIndexTransaction[]
  ) {
    return _.merge(
      groupTransactionsByHour<AggregationData>(
        allTransactions,
        async (group) => ({
          all: group.length,
        })
      ),
      groupTransactionsByHour<AggregationData>(
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
}
