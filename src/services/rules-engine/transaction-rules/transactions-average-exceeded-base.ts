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
import { TransactionAggregationRule } from './aggregation-rule'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '@/services/rules-engine/repositories/transaction-repository'
import { getTimestampRange } from '@/services/rules-engine/utils/time-utils'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleHitResultItem } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { neverThrow } from '@/utils/lang'
import { ExtendedJSONSchemaType } from '@/services/rules-engine/utils/rule-schema-utils'
import { multiplierToPercents } from '@/services/rules-engine/utils/math-utils'

type AggregationData = {
  count?: number
  amount?: number
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
  transactionRepository?: TransactionRepository

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

  private async avg(
    period1AmountDetails: (TransactionAmountDetails | undefined)[],
    period2AmountDetails: (TransactionAmountDetails | undefined)[],
    currency: CurrencyCode
  ): Promise<[number, number] | undefined> {
    const {
      averageThreshold,
      transactionsNumberThreshold,
      transactionsNumberThreshold2,
    } = this.parameters

    const { min: avgMin, max: avgMax } = averageThreshold ?? {}
    const {
      min: period1TransactionsNumberMin,
      max: period1TransactionsNumberMax,
    } = transactionsNumberThreshold ?? {}
    const {
      min: period2TransactionsNumberMin,
      max: period2TransactionsNumberMax,
    } = transactionsNumberThreshold2 ?? {}
    const transactionsCountPeriod1 = period1AmountDetails.length
    const transactionsCountPeriod2 = period2AmountDetails.length

    if (
      (period1TransactionsNumberMin &&
        transactionsCountPeriod1 < period1TransactionsNumberMin) ||
      (period1TransactionsNumberMax &&
        transactionsCountPeriod1 > period1TransactionsNumberMax)
    ) {
      return
    }
    if (
      (period2TransactionsNumberMin &&
        transactionsCountPeriod2 < period2TransactionsNumberMin) ||
      (period2TransactionsNumberMax &&
        transactionsCountPeriod2 > period2TransactionsNumberMax)
    ) {
      return
    }

    let result: [number, number]
    const avgMethod = this.getAvgMethod()
    if (avgMethod === 'AMOUNT') {
      const amountDetails1 = period1AmountDetails.filter(
        Boolean
      ) as TransactionAmountDetails[]
      const amountDetails2 = period2AmountDetails.filter(
        Boolean
      ) as TransactionAmountDetails[]

      const { units1, units2 } = this.getPeriodUnits()

      const totalAmountPeriod1 = await getTransactionsTotalAmount(
        amountDetails1,
        currency
      )
      const totalAmountPeriod2 = await getTransactionsTotalAmount(
        amountDetails2,
        currency
      )

      if (
        (avgMin != null && totalAmountPeriod1.transactionAmount < avgMin) ||
        (avgMax != null && totalAmountPeriod2.transactionAmount > avgMax)
      ) {
        return
      }

      result = [
        totalAmountPeriod1.transactionAmount / units1,
        totalAmountPeriod2.transactionAmount / units2,
      ]
    } else if (avgMethod === 'NUMBER') {
      const { units1, units2 } = this.getPeriodUnits()
      result = [
        transactionsCountPeriod1 / units1,
        transactionsCountPeriod2 / units2,
      ]

      if (
        (avgMin != null && result[0] < avgMin) ||
        (avgMax != null && result[0] > avgMax)
      ) {
        return
      }
    } else {
      throw neverThrow(avgMethod, `Method not supported: ${avgMethod}`)
    }

    return result
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
    if (direction === 'origin' && this.parameters.checkSender === 'none') {
      return
    } else if (
      direction === 'destination' &&
      this.parameters.checkReceiver === 'none'
    ) {
      return
    }

    const data = await this.getData(direction)
    if (!data) {
      return
    }
    const multiplier = data.avgPeriod1 / data.avgPeriod2
    const { value: maxMultiplier, currency } = this.getMultiplierThresholds()
    const result = multiplierToPercents(multiplier) > maxMultiplier
    if (result) {
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

  private async getData(direction: 'origin' | 'destination'): Promise<
    | {
        avgPeriod1: number
        avgPeriod2: number
      }
    | undefined
  > {
    const {
      afterTimestamp: afterTimestampP1,
      beforeTimestamp: beforeTimestampP1,
    } = getTimestampRange(this.transaction.timestamp!, this.parameters.period1)
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
      const { min: avgMin, max: avgMax } =
        this.parameters.averageThreshold ?? {}
      const avgMethod = this.getAvgMethod()
      const { units1, units2 } = this.getPeriodUnits()
      const transactionsCountPeriod1 =
        _.sumBy(userAggregationDataP1, (data) => data.count!) + 1
      const transactionsCountPeriod2 =
        _.sumBy(userAggregationDataP2, (data) => data.count!) +
        (this.parameters.excludePeriod1 ? 0 : 1)
      let avg1 = 0
      let avg2 = 0
      let isWithinAvgThresholds = true

      if (avgMethod === 'NUMBER') {
        avg1 = transactionsCountPeriod1 / units1
        avg2 = transactionsCountPeriod2 / units2
        isWithinAvgThresholds =
          (!avgMin || avg1 >= avgMin) && (!avgMax || avg1 <= avgMax)
      } else if (avgMethod === 'AMOUNT') {
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
        const transactionsAmountPeriod1 =
          _.sumBy(userAggregationDataP1, (data) => data.amount!) + currentAmount
        const transactionsAmountPeriod2 =
          _.sumBy(userAggregationDataP2, (data) => data.amount!) +
          (this.parameters.excludePeriod1 ? 0 : currentAmount)

        avg1 = transactionsAmountPeriod1 / units1
        avg2 = transactionsAmountPeriod2 / units2
        const transactionsAmountAveragePeriod1 =
          transactionsAmountPeriod1 / transactionsCountPeriod1
        isWithinAvgThresholds =
          (!avgMin || transactionsAmountAveragePeriod1 >= avgMin) &&
          (!avgMax || transactionsAmountAveragePeriod1 <= avgMax)
      }
      if (isWithinAvgThresholds) {
        return {
          avgPeriod1: avg1,
          avgPeriod2: avg2,
        }
      }
      return
    }

    // Fallback
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const { period2, checkSender, checkReceiver } = this.parameters

    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        transactionRepository,
        {
          timeWindow: period2,
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
    await this.refreshRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(
        sendingTransactions,
        receivingTransactions
      )
    )

    const { currency } = this.getMultiplierThresholds()
    const avgs = await this.avg(
      period1AmountDetails,
      period2AmountDetails,
      currency
    )

    if (avgs) {
      return {
        avgPeriod1: avgs[0],
        avgPeriod2: avgs[1],
      }
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

  protected async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    const avgMethod = this.getAvgMethod()
    const { currency } = this.getMultiplierThresholds()
    let amount = 0
    if (avgMethod === 'AMOUNT') {
      if (direction === 'origin' && this.transaction.originAmountDetails) {
        amount = (
          await getTargetCurrencyAmount(
            this.transaction.originAmountDetails,
            currency
          )
        ).transactionAmount
      } else if (
        direction === 'destination' &&
        this.transaction.destinationAmountDetails
      ) {
        amount = (
          await getTargetCurrencyAmount(
            this.transaction.destinationAmountDetails,
            currency
          )
        ).transactionAmount
      }
    }
    return {
      count: (targetAggregationData?.count ?? 0) + 1,
      amount:
        avgMethod === 'AMOUNT'
          ? (targetAggregationData?.amount || 0) + amount
          : undefined,
    }
  }

  protected getMaxTimeWindow(): TimeWindow {
    return this.parameters.period2
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    const transactions = [
      ...sendingTransactions,
      ...receivingTransactions.map((t) => ({
        ...t,
        originAmountDetails: t.destinationAmountDetails,
      })),
    ]

    return groupTransactionsByHour<AggregationData>(
      transactions,
      async (group) => ({
        count: group.length,
        amount:
          this.getAvgMethod() === 'AMOUNT'
            ? (
                await getTransactionsTotalAmount(
                  group.map((t) => t.originAmountDetails),
                  this.getMultiplierThresholds().currency
                )
              ).transactionAmount
            : undefined,
      })
    )
  }

  protected getRuleAggregationVersion(): number {
    return 1
  }
}
