import { inRange, mergeWith, random, sumBy } from 'lodash'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  DAY_WINDOW_SCHEMA,
  TimeWindow,
  DayWindow,
  TRANSACTIONS_NUMBER_THRESHOLD_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionAggregationRule } from './aggregation-rule'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getTimestampRange } from '@/services/rules-engine/utils/time-utils'
import { RuleHitResultItem } from '@/services/rules-engine/rule'
import { ExtendedJSONSchemaType } from '@/services/rules-engine/utils/rule-schema-utils'
import { multiplierToPercents } from '@/services/rules-engine/utils/math-utils'
import { mergeObjects } from '@/utils/object'
import { CurrencyService } from '@/services/currency'
import { traceable } from '@/core/xray'

type AggregationData = {
  sendingCount?: number
  sendingAmount?: number
  receivingCount?: number
  receivingAmount?: number
}

type AggregationResultStats = {
  totalAmount?: number
  totalCount: number
}
type AggregationResult = {
  period1: AggregationResultStats
  period2: AggregationResultStats
}

export type TransactionsExceededParameters = {
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
  valueThresholdPeriod1?: {
    min?: number
    max?: number
  }
}

@traceable
export default abstract class TransactionsDeviationBaseRule<
  Params extends TransactionsExceededParameters
> extends TransactionAggregationRule<
  Params,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getBaseSchema(): ExtendedJSONSchemaType<TransactionsExceededParameters> {
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
        transactionsNumberThreshold:
          TRANSACTIONS_NUMBER_THRESHOLD_OPTIONAL_SCHEMA({
            title: 'Transactions number threshold (period1)',
            description:
              "Rule doesn't trigger if transactions number in period1 in less than 'Min' or more than 'Max'",
          }),
        transactionsNumberThreshold2:
          TRANSACTIONS_NUMBER_THRESHOLD_OPTIONAL_SCHEMA({
            title: 'Transactions number threshold (period2)',
            description:
              "Rule doesn't trigger if transactions number in period2 in less than 'Min' or more than 'Max'",
          }),
        valueThresholdPeriod1: TRANSACTIONS_NUMBER_THRESHOLD_OPTIONAL_SCHEMA({
          title: 'Average threshold (period1)',
          description:
            "Rule doesn't trigger if average in period1 in less than 'Min' or more than 'Max'",
        }),
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
          'valueThresholdPeriod1',
        ],
      },
    }
  }

  protected abstract getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  }

  protected abstract getAggregationType(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT'

  protected abstract getAggregatorMethod(): 'SUM' | 'AVG'

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

    const { period1, period2 } = data

    // Filter stage
    const aggregationType = this.getAggregationType()
    const aggregationMethod = this.getAggregatorMethod()
    const { units1, units2 } = this.getPeriodUnits()
    const {
      valueThresholdPeriod1,
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

    const { min = 0, max = Infinity } = valueThresholdPeriod1 ?? {}

    let value = 0
    if (aggregationMethod === 'AVG') {
      if (aggregationType === 'AMOUNT') {
        value = (period1.totalAmount ?? 0) / period1.totalCount
      } else if (aggregationType === 'DAILY_AMOUNT') {
        value = (period1.totalAmount ?? 0) / units1
      } else {
        value = period1.totalCount / units1
      }
    } else if (aggregationMethod === 'SUM') {
      if (aggregationType === 'AMOUNT' || aggregationType === 'DAILY_AMOUNT') {
        value = period1.totalAmount ?? 0
      } else {
        value = period1.totalCount
      }
    }

    // +1 because end of range is exclusive
    if (!inRange(value, min, max + 1)) {
      return
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
      aggregationType === 'AMOUNT'
        ? (period1.totalAmount ?? 0) / period1.totalCount
        : aggregationType === 'NUMBER'
        ? period1.totalCount / units1
        : (period1.totalAmount ?? 0) / units1

    const avgPeriod2 =
      aggregationType === 'AMOUNT'
        ? (period2.totalAmount ?? 0) / period2.totalCount
        : aggregationType === 'NUMBER'
        ? period2.totalCount / units2
        : (period2.totalAmount ?? 0) / units2

    const sumPeriod1 =
      aggregationType === 'AMOUNT'
        ? period1.totalAmount ?? 0
        : aggregationType === 'NUMBER'
        ? period1.totalCount
        : period1.totalAmount ?? 0

    const sumPeriod2 =
      aggregationType === 'AMOUNT'
        ? period2.totalAmount ?? 0
        : aggregationType === 'NUMBER'
        ? period2.totalCount
        : period2.totalAmount ?? 0

    const multiplier =
      aggregationMethod === 'AVG'
        ? avgPeriod1 / avgPeriod2
        : period2.totalCount === 0
        ? 0
        : sumPeriod1 / sumPeriod2

    const { value: maxMultiplier, currency } = this.getMultiplierThresholds()

    if (
      Number.isFinite(multiplier) &&
      multiplierToPercents(multiplier) > maxMultiplier
    ) {
      let falsePositiveDetails

      if (this.ruleInstance.falsePositiveCheckEnabled) {
        if ((multiplier - maxMultiplier) / multiplier < 0.05) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: random(60, 80),
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

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const { checkReceiver, checkSender } = this.parameters

    const checkDirection = direction === 'origin' ? checkSender : checkReceiver

    yield* await getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow: this.parameters.period2,
        checkDirection,
        filters: this.filters,
      },
      ['timestamp', 'originAmountDetails', 'destinationAmountDetails']
    )
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationResult | undefined> {
    const currencyService = new CurrencyService()
    const {
      afterTimestamp: afterTimestampP1,
      beforeTimestamp: beforeTimestampP1,
    } = getTimestampRange(this.transaction.timestamp, this.parameters.period1)
    const {
      afterTimestamp: afterTimestampP2,
      beforeTimestamp: beforeTimestampP2,
    } = this.getPeriod2TimeRange()
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestampP2,
      beforeTimestampP1
    )
    const checkDirection =
      direction === 'origin'
        ? this.parameters.checkSender
        : this.parameters.checkReceiver

    if (userAggregationData) {
      const userAggregationDataP1 =
        this.getFilterAggregationData<AggregationData>(
          userAggregationData,
          afterTimestampP1,
          beforeTimestampP1
        )
      const userAggregationDataP2 = this.getFilterAggregationData(
        userAggregationData,
        afterTimestampP2,
        beforeTimestampP2
      )
      let transactionsSendingCountPeriod1 =
        checkDirection !== 'receiving'
          ? sumBy(userAggregationDataP1, (data) => data.sendingCount ?? 0)
          : 0

      let transactionsSendingCountPeriod2 =
        checkDirection !== 'receiving'
          ? sumBy(userAggregationDataP2, (data) => data.sendingCount ?? 0)
          : 0

      let transactionsReceivingCountPeriod1 =
        checkDirection !== 'sending'
          ? sumBy(userAggregationDataP1, (data) => data.receivingCount ?? 0)
          : 0

      let transactionsReceivingCountPeriod2 =
        checkDirection !== 'sending'
          ? sumBy(userAggregationDataP2, (data) => data.receivingCount ?? 0)
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
      const aggregationType = this.getAggregationType()

      if (aggregationType === 'AMOUNT' || aggregationType === 'DAILY_AMOUNT') {
        const amountDetails =
          direction === 'origin'
            ? this.transaction.originAmountDetails
            : this.transaction.destinationAmountDetails

        const currentAmount = amountDetails
          ? (
              await currencyService.getTargetCurrencyAmount(
                amountDetails,
                this.getMultiplierThresholds().currency
              )
            ).transactionAmount
          : 0

        let transactionsSendingAmountPeriod1 =
          checkDirection !== 'receiving'
            ? sumBy(userAggregationDataP1, (data) => data.sendingAmount ?? 0)
            : 0

        let transactionsSendingAmountPeriod2 =
          checkDirection !== 'receiving'
            ? sumBy(userAggregationDataP2, (data) => data.sendingAmount ?? 0)
            : 0

        let transactionsReceivingAmountPeriod1 =
          checkDirection !== 'sending'
            ? sumBy(userAggregationDataP1, (data) => data.receivingAmount ?? 0)
            : 0

        let transactionsReceivingAmountPeriod2 =
          checkDirection !== 'sending'
            ? sumBy(userAggregationDataP2, (data) => data.receivingAmount ?? 0)
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

    let aggregationResult = await this.getAggregationResult(
      direction === 'origin' ? [this.transaction] : [],
      direction === 'origin' ? [] : [this.transaction]
    )
    if (this.shouldUseRawData()) {
      for await (const data of this.getRawTransactionsData(direction)) {
        const partialAggregationResult = await this.getAggregationResult(
          data.sendingTransactions,
          data.receivingTransactions
        )
        aggregationResult = mergeWith(
          aggregationResult,
          partialAggregationResult,
          (a: AggregationResultStats, b: AggregationResultStats) => {
            return mergeWith(
              a,
              b,
              (x: number | undefined, y: number | undefined) =>
                (x ?? 0) + (y ?? 0)
            )
          }
        )
      }
      return aggregationResult
    } else {
      return aggregationResult
    }
  }

  private async getAggregationResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ): Promise<AggregationResult> {
    const sendingTransactionsToCheck = [...sendingTransactions]
    const receivingTransactionsToCheck = [...receivingTransactions]
    const aggregationType = this.getAggregationType()
    const { currency } = this.getMultiplierThresholds()

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

    return {
      period1: {
        totalCount: period1AmountDetails.length,
        totalAmount:
          aggregationType === 'AMOUNT' || aggregationType === 'DAILY_AMOUNT'
            ? (await getTransactionsTotalAmount(period1AmountDetails, currency))
                .transactionAmount
            : undefined,
      },
      period2: {
        totalCount: period2AmountDetails.length,
        totalAmount:
          aggregationType === 'AMOUNT' || aggregationType === 'DAILY_AMOUNT'
            ? (await getTransactionsTotalAmount(period2AmountDetails, currency))
                .transactionAmount
            : undefined,
      },
    }
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions
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

  private getPeriod1Transactions(
    transactions: AuxiliaryIndexTransaction[]
  ): AuxiliaryIndexTransaction[] {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      this.parameters.period1
    )
    return transactions.filter(
      (transaction) =>
        transaction.timestamp &&
        transaction.timestamp >= afterTimestamp &&
        transaction.timestamp <= beforeTimestamp
    )
  }

  private getPeriod2Transactions(
    transactions: AuxiliaryIndexTransaction[]
  ): AuxiliaryIndexTransaction[] {
    const { afterTimestamp, beforeTimestamp } = this.getPeriod2TimeRange()
    return transactions.filter(
      (transaction) =>
        transaction.timestamp &&
        transaction.timestamp >= afterTimestamp &&
        transaction.timestamp <= beforeTimestamp
    )
  }

  private getPeriod2TimeRange(): {
    afterTimestamp: number
    beforeTimestamp: number
  } {
    const {
      afterTimestamp: afterTimestampP1,
      beforeTimestamp: beforeTimestampP1,
    } = getTimestampRange(this.transaction.timestamp, this.parameters.period1)
    const { afterTimestamp } = getTimestampRange(
      this.transaction.timestamp,
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
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const aggregationType = this.getAggregationType()
    const { currency } = this.getMultiplierThresholds()
    const data = {
      ...targetAggregationData,
    }

    if (direction === 'origin') {
      data.sendingCount = (data.sendingCount ?? 0) + 1
    } else if (direction === 'destination') {
      data.receivingCount = (data.receivingCount ?? 0) + 1
    }

    const currencyService = new CurrencyService()

    if (aggregationType === 'AMOUNT' || aggregationType === 'DAILY_AMOUNT') {
      if (direction === 'origin' && this.transaction.originAmountDetails) {
        data.sendingAmount =
          (data.sendingAmount ?? 0) +
          (
            await currencyService.getTargetCurrencyAmount(
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
            await currencyService.getTargetCurrencyAmount(
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
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
          sendingAmount:
            this.getAggregationType() === 'AMOUNT' ||
            this.getAggregationType() === 'DAILY_AMOUNT'
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
            this.getAggregationType() === 'AMOUNT' ||
            this.getAggregationType() === 'DAILY_AMOUNT'
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
