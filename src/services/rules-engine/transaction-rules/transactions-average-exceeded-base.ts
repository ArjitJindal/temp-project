import _ from 'lodash'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  DAY_WINDOW_SCHEMA,
  TimeWindow,
  DayWindow,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionAggregationRule } from './aggregation-rule'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getTimestampRange } from '@/services/rules-engine/utils/time-utils'
import { RuleHitResultItem } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { ExtendedJSONSchemaType } from '@/services/rules-engine/utils/rule-schema-utils'
import { multiplierToPercents } from '@/services/rules-engine/utils/math-utils'

type AggregationData = {
  sendingCount?: number
  sendingAmount?: number
  receivingCount?: number
  receivingAmount?: number
}

export type TransactionsAverageExceededParameters = {
  period1: DayWindow
  period2: DayWindow
  excludePeriod1?: boolean
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  transactionsNumberThreshold?: {
    min?: number
    max?: number
  }
  transactionsNumberThreshold2?: {
    min?: number
    max?: number
  }
  averageThreshold?: {
    min?: number
    max?: number
  }
}

export default abstract class TransactionAverageExceededBaseRule<
  Params extends TransactionsAverageExceededParameters
> extends TransactionAggregationRule<
  Params,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getBaseSchema(): ExtendedJSONSchemaType<TransactionsAverageExceededParameters> {
    return {
      type: 'object',
      properties: {
        period1: DAY_WINDOW_SCHEMA({
          title: 'period1 (Current period)',
        }),
        period2: DAY_WINDOW_SCHEMA({
          title: 'period2 (Reference period, should be larger than period1)',
        }),
        excludePeriod1: {
          type: 'boolean',
          title: 'Exclude transactions in period1 from period2',
          nullable: true,
        },
        transactionsNumberThreshold: {
          type: 'object',
          title:
            "Rule doesn't trigger if transactions number in period1 in less than 'Min' or more than 'Max'",
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        transactionsNumberThreshold2: {
          type: 'object',
          title:
            "Rule doesn't trigger if transactions number in period2 in less than 'Min' or more than 'Max'",
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        averageThreshold: {
          type: 'object',
          title: 'Average threshold (period 1)',
          description:
            "Rule doesn't trigger if average in period1 in less than 'Min' or more than 'Max'",
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
      },
      required: ['period1', 'period2', 'checkSender', 'checkReceiver'],
      'ui:schema': {
        'ui:order': [
          'period1',
          'period2',
          'excludePeriod1',
          'checkSender',
          'checkReceiver',
          'transactionsNumberThreshold',
          'transactionsNumberThreshold2',
          'averageThreshold',
        ],
      },
    }
  }

  protected abstract getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  }

  protected abstract getAvgMethod(): 'AMOUNT' | 'NUMBER'

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

    const { period1, period2 } = await this.getData(direction)

    // Filter stage
    const avgMethod = this.getAvgMethod()
    const { units1, units2 } = this.getPeriodUnits()
    const {
      averageThreshold,
      transactionsNumberThreshold,
      transactionsNumberThreshold2,
    } = this.parameters
    const {
      min: period1TransactionsNumberMin,
      max: period1TransactionsNumberMax,
    } = transactionsNumberThreshold ?? {}
    const {
      min: period2TransactionsNumberMin,
      max: period2TransactionsNumberMax,
    } = transactionsNumberThreshold2 ?? {}
    const { min: avgMin, max: avgMax } = averageThreshold ?? {}

    if (avgMethod === 'AMOUNT') {
      const avg = period1.totalAmount! / period1.totalCount
      if (
        (avgMin != null && avg < avgMin) ||
        (avgMax != null && avg > avgMax)
      ) {
        return
      }
    } else {
      const avg = period1.totalCount / units1
      if (
        (avgMin != null && avg < avgMin) ||
        (avgMax != null && avg > avgMax)
      ) {
        return
      }
    }
    if (
      (period1TransactionsNumberMin &&
        period1.totalCount < period1TransactionsNumberMin) ||
      (period1TransactionsNumberMax &&
        period1.totalCount > period1TransactionsNumberMax)
    ) {
      return
    }
    if (
      (period2TransactionsNumberMin &&
        period2.totalCount < period2TransactionsNumberMin) ||
      (period2TransactionsNumberMax &&
        period2.totalCount > period2TransactionsNumberMax)
    ) {
      return
    }

    // Check against the real threshold
    const avgPeriod1 =
      avgMethod === 'AMOUNT'
        ? period1.totalAmount! / units1
        : period1.totalCount / units1
    const avgPeriod2 =
      avgMethod === 'AMOUNT'
        ? period2.totalAmount! / units2
        : period2.totalCount / units2
    const multiplier = avgPeriod1 / avgPeriod2
    const { value: maxMultiplier, currency } = this.getMultiplierThresholds()

    if (multiplierToPercents(multiplier) > maxMultiplier) {
      let falsePositiveDetails
      if (this.ruleInstance.falsePositiveCheckEnabled) {
        if ((multiplier - maxMultiplier) / multiplier < 0.05) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: _.random(60, 80),
          }
        }
      }
      const vars = {
        ...super.getTransactionVars(direction),
        period1: this.parameters.period1,
        period2: this.parameters.period2,
        multiplier,
        user: direction,
        currency,
      }
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars,
        falsePositiveDetails,
      }
    }
  }

  private async getData(direction: 'origin' | 'destination'): Promise<{
    period1: {
      totalAmount?: number
      totalCount: number
    }
    period2: {
      totalAmount?: number
      totalCount: number
    }
  }> {
    const {
      afterTimestamp: afterTimestampP1,
      beforeTimestamp: beforeTimestampP1,
    } = getTimestampRange(this.transaction.timestamp!, this.parameters.period1)
    const avgMethod = this.getAvgMethod()
    const { currency } = this.getMultiplierThresholds()
    const checkDirection =
      direction === 'origin'
        ? this.parameters.checkSender
        : this.parameters.checkReceiver
    const userAggregationDataP1 =
      await this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestampP1,
        beforeTimestampP1
      )
    const {
      afterTimestamp: afterTimestampP2,
      beforeTimestamp: beforeTimestampP2,
    } = this.getPeriod2TimeRange()
    const userAggregationDataP2 =
      await this.getRuleAggregations<AggregationData>(
        direction,
        afterTimestampP2,
        beforeTimestampP2
      )

    if (userAggregationDataP1 && userAggregationDataP2) {
      let transactionsSendingCountPeriod1 =
        checkDirection !== 'receiving'
          ? _.sumBy(userAggregationDataP1, (data) => data.sendingCount ?? 0)
          : 0
      let transactionsSendingCountPeriod2 =
        checkDirection !== 'receiving'
          ? _.sumBy(userAggregationDataP2, (data) => data.sendingCount ?? 0)
          : 0
      let transactionsReceivingCountPeriod1 =
        checkDirection !== 'sending'
          ? _.sumBy(userAggregationDataP1, (data) => data.receivingCount ?? 0)
          : 0
      let transactionsReceivingCountPeriod2 =
        checkDirection !== 'sending'
          ? _.sumBy(userAggregationDataP2, (data) => data.receivingCount ?? 0)
          : 0

      if (direction === 'origin') {
        transactionsSendingCountPeriod1 += 1
        if (!this.parameters.excludePeriod1) {
          transactionsSendingCountPeriod2 += 1
        }
      } else {
        transactionsReceivingCountPeriod1 += 1
        if (!this.parameters.excludePeriod1) {
          transactionsReceivingCountPeriod2 += 1
        }
      }
      const transactionsCountPeriod1 =
        transactionsSendingCountPeriod1 + transactionsReceivingCountPeriod1
      const transactionsCountPeriod2 =
        transactionsSendingCountPeriod2 + transactionsReceivingCountPeriod2

      if (avgMethod === 'AMOUNT') {
        const amountDetails =
          direction === 'origin'
            ? this.transaction.originAmountDetails!
            : this.transaction.destinationAmountDetails!
        const currentAmount = amountDetails
          ? (
              await getTargetCurrencyAmount(
                amountDetails,
                this.getMultiplierThresholds().currency
              )
            ).transactionAmount
          : 0
        let transactionsSendingAmountPeriod1 =
          checkDirection !== 'receiving'
            ? _.sumBy(userAggregationDataP1, (data) => data.sendingAmount ?? 0)
            : 0
        let transactionsSendingAmountPeriod2 =
          checkDirection !== 'receiving'
            ? _.sumBy(userAggregationDataP2, (data) => data.sendingAmount ?? 0)
            : 0
        let transactionsReceivingAmountPeriod1 =
          checkDirection !== 'sending'
            ? _.sumBy(
                userAggregationDataP1,
                (data) => data.receivingAmount ?? 0
              )
            : 0
        let transactionsReceivingAmountPeriod2 =
          checkDirection !== 'sending'
            ? _.sumBy(
                userAggregationDataP2,
                (data) => data.receivingAmount ?? 0
              )
            : 0

        if (direction === 'origin') {
          transactionsSendingAmountPeriod1 += currentAmount
          if (!this.parameters.excludePeriod1) {
            transactionsSendingAmountPeriod2 += currentAmount
          }
        } else {
          transactionsReceivingAmountPeriod1 += currentAmount
          if (!this.parameters.excludePeriod1) {
            transactionsReceivingAmountPeriod2 += currentAmount
          }
        }

        const transactionsAmountPeriod1 =
          transactionsSendingAmountPeriod1 + transactionsReceivingAmountPeriod1
        const transactionsAmountPeriod2 =
          transactionsSendingAmountPeriod2 + transactionsReceivingAmountPeriod2

        return {
          period1: {
            totalCount: transactionsCountPeriod1,
            totalAmount: transactionsAmountPeriod1,
          },
          period2: {
            totalCount: transactionsCountPeriod2,
            totalAmount: transactionsAmountPeriod2,
          },
        }
      } else {
        return {
          period1: {
            totalCount: transactionsCountPeriod1,
          },
          period2: {
            totalCount: transactionsCountPeriod2,
          },
        }
      }
    }

    // Fallback
    const { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: this.parameters.period2,
          checkDirection,
          transactionStates: this.filters.transactionStatesHistorical,
          transactionTypes: this.filters.transactionTypesHistorical,
          paymentMethod: this.filters.paymentMethodHistorical,
        },
        ['timestamp', 'originAmountDetails', 'destinationAmountDetails']
      )
    const sendingTransactionsToCheck = [...sendingTransactions]
    const receivingTransactionsToCheck = [...receivingTransactions]
    if (direction === 'origin') {
      sendingTransactionsToCheck.push(this.transaction)
    } else {
      receivingTransactionsToCheck.push(this.transaction)
    }
    const period1AmountDetails = this.getPeriod1Transactions(
      sendingTransactionsToCheck
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod1Transactions(receivingTransactionsToCheck).map(
          (transaction) => transaction.destinationAmountDetails
        )
      )
    const period2AmountDetails = this.getPeriod2Transactions(
      sendingTransactionsToCheck
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod2Transactions(receivingTransactionsToCheck).map(
          (transaction) => transaction.destinationAmountDetails
        )
      )

    // Update aggregations
    const aggregationResult = await this.getTimeAggregatedResult(
      sendingTransactions,
      receivingTransactions
    )
    await this.refreshRuleAggregations(direction, aggregationResult)

    return {
      period1: {
        totalCount: period1AmountDetails.length,
        totalAmount:
          avgMethod === 'AMOUNT'
            ? (await getTransactionsTotalAmount(period1AmountDetails, currency))
                .transactionAmount
            : undefined,
      },
      period2: {
        totalCount: period2AmountDetails.length,
        totalAmount:
          avgMethod === 'AMOUNT'
            ? (await getTransactionsTotalAmount(period2AmountDetails, currency))
                .transactionAmount
            : undefined,
      },
    }
  }

  private getPeriod1Transactions(
    transactions: AuxiliaryIndexTransaction[]
  ): AuxiliaryIndexTransaction[] {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.period1
    )
    return transactions.filter(
      (transaction) =>
        transaction.timestamp! >= afterTimestamp &&
        transaction.timestamp! <= beforeTimestamp
    )
  }

  private getPeriod2Transactions(
    transactions: AuxiliaryIndexTransaction[]
  ): AuxiliaryIndexTransaction[] {
    const { afterTimestamp, beforeTimestamp } = this.getPeriod2TimeRange()
    return transactions.filter(
      (transaction) =>
        transaction.timestamp! >= afterTimestamp &&
        transaction.timestamp! <= beforeTimestamp
    )
  }

  private getPeriod2TimeRange(): {
    afterTimestamp: number
    beforeTimestamp: number
  } {
    const {
      afterTimestamp: afterTimestampP1,
      beforeTimestamp: beforeTimestampP1,
    } = getTimestampRange(this.transaction.timestamp!, this.parameters.period1)
    const { afterTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.period2
    )
    const beforeTimestamp = this.parameters.excludePeriod1
      ? afterTimestampP1
      : beforeTimestampP1
    return { afterTimestamp, beforeTimestamp }
  }

  private getPeriodUnits() {
    const { period1, period2, excludePeriod1 } = this.parameters
    const units1 = period1.units
    const units2 = excludePeriod1
      ? period2.units - period1.units
      : period2.units
    return {
      units1,
      units2,
    }
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    const avgMethod = this.getAvgMethod()
    const { currency } = this.getMultiplierThresholds()
    const data = {
      ...targetAggregationData,
    }

    if (direction === 'origin') {
      data.sendingCount = (data.sendingCount ?? 0) + 1
    } else if (direction === 'destination') {
      data.receivingCount = (data.receivingCount ?? 0) + 1
    }

    if (avgMethod === 'AMOUNT') {
      if (direction === 'origin' && this.transaction.originAmountDetails) {
        data.sendingAmount =
          (data.sendingAmount ?? 0) +
          (
            await getTargetCurrencyAmount(
              this.transaction.originAmountDetails,
              currency
            )
          ).transactionAmount
      } else if (
        direction === 'destination' &&
        this.transaction.destinationAmountDetails
      ) {
        data.receivingAmount =
          (data.receivingAmount ?? 0) +
          (
            await getTargetCurrencyAmount(
              this.transaction.destinationAmountDetails,
              currency
            )
          ).transactionAmount
      }
    }
    return data
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.period2
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return _.merge(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
          sendingAmount:
            this.getAvgMethod() === 'AMOUNT'
              ? (
                  await getTransactionsTotalAmount(
                    group.map((t) => t.originAmountDetails),
                    this.getMultiplierThresholds().currency
                  )
                ).transactionAmount
              : undefined,
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          receivingCount: group.length,
          receivingAmount:
            this.getAvgMethod() === 'AMOUNT'
              ? (
                  await getTransactionsTotalAmount(
                    group.map((t) => t.destinationAmountDetails),
                    this.getMultiplierThresholds().currency
                  )
                ).transactionAmount
              : undefined,
        })
      )
    )
  }

  override getRuleAggregationVersion(): number {
    return 2
  }
}
