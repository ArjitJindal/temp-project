import { JSONSchemaType } from 'ajv'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  getTransactionStatsTimeGroupLabelV2,
} from '../utils/transaction-rule-utils'
import { RuleHitResultItem } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { TimeWindow } from '@/@types/rule/params'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { CurrencyService } from '@/services/currency'
import dayjs from '@/utils/dayjs'

type EmptyParams = Record<string, never>

type DailyMetrics = {
  totalCount: number
  totalAmount?: number
  roundCount?: number
}

type AggregationData = {
  sendingCount?: number
  sendingAmount?: number
  receivingCount?: number
  receivingAmount?: number
  roundCount?: number
}

type MetricType = 'AMOUNT' | 'COUNT' | 'AVG_AMOUNT' | 'ROUND_PERCENT'

export abstract class TransactionsStandardDeviationAnomalyBaseRule extends TransactionAggregationRule<
  EmptyParams,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<EmptyParams> {
    return {
      type: 'object',
      properties: {},
      required: [],
    }
  }

  protected abstract getMetricType(): MetricType

  protected getTargetCurrency(): CurrencyCode {
    return (this.rule.defaultBaseCurrency as CurrencyCode) ?? 'USD'
  }

  protected getStddevThreshold(): number {
    return 2
  }

  protected getWindowDays(): { periodDays: number; baselineDays: number } {
    return { periodDays: 30, baselineDays: 90 }
  }

  protected getMaxTimeWindow(): TimeWindow {
    const { baselineDays } = this.getWindowDays()
    return { units: baselineDays, granularity: 'day' }
  }

  protected async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const metricType = this.getMetricType()
    const data = { ...aggregation } as AggregationData

    if (direction === 'origin') {
      data.sendingCount = (data.sendingCount ?? 0) + 1
    } else {
      data.receivingCount = (data.receivingCount ?? 0) + 1
    }

    if (metricType === 'AMOUNT' || metricType === 'AVG_AMOUNT') {
      const currencyService = new CurrencyService(this.dynamoDb)
      const amountDetails =
        direction === 'origin'
          ? this.transaction.originAmountDetails
          : this.transaction.destinationAmountDetails

      if (amountDetails) {
        const converted = await currencyService.getTargetCurrencyAmount(
          amountDetails,
          this.getTargetCurrency()
        )
        if (direction === 'origin') {
          data.sendingAmount =
            (data.sendingAmount ?? 0) + converted.transactionAmount
        } else {
          data.receivingAmount =
            (data.receivingAmount ?? 0) + converted.transactionAmount
        }
      }
    }

    if (metricType === 'ROUND_PERCENT') {
      const amountDetails =
        direction === 'origin'
          ? this.transaction.originAmountDetails
          : this.transaction.destinationAmountDetails
      const amt = amountDetails?.transactionAmount
      if (amt != null && isRoundHundreds(amt)) {
        data.roundCount = (data.roundCount ?? 0) + 1
      }
    }

    return data
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    _isTransactionFiltered: boolean
  ): boolean {
    // Always update aggregation for future evaluations
    return true
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    const { baselineDays } = this.getWindowDays()
    const timeAggregatedResult: { [key: string]: AggregationData } = {}

    for await (const batch of getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      direction,
      this.transactionRepository,
      {
        timeWindow: { units: baselineDays, granularity: 'day' },
        checkDirection: 'all',
        filters: this.filters,
      },
      ['timestamp', 'originAmountDetails', 'destinationAmountDetails']
    )) {
      for (const tx of batch.sendingTransactions) {
        const dayKey = getTransactionStatsTimeGroupLabelV2(
          tx.timestamp as number,
          'day'
        )
        const existing = timeAggregatedResult[dayKey] || {}
        existing.sendingCount = (existing.sendingCount ?? 0) + 1

        if (
          this.getMetricType() === 'AMOUNT' ||
          this.getMetricType() === 'AVG_AMOUNT'
        ) {
          const currencyService = new CurrencyService(this.dynamoDb)
          if (tx.originAmountDetails) {
            const converted = await currencyService.getTargetCurrencyAmount(
              tx.originAmountDetails,
              this.getTargetCurrency()
            )
            existing.sendingAmount =
              (existing.sendingAmount ?? 0) + converted.transactionAmount
          }
        }

        if (this.getMetricType() === 'ROUND_PERCENT') {
          const amt = tx.originAmountDetails?.transactionAmount
          if (amt != null && isRoundHundreds(amt)) {
            existing.roundCount = (existing.roundCount ?? 0) + 1
          }
        }

        timeAggregatedResult[dayKey] = existing
      }

      for (const tx of batch.receivingTransactions) {
        const dayKey = getTransactionStatsTimeGroupLabelV2(
          tx.timestamp as number,
          'day'
        )
        const existing = timeAggregatedResult[dayKey] || {}
        existing.receivingCount = (existing.receivingCount ?? 0) + 1

        if (
          this.getMetricType() === 'AMOUNT' ||
          this.getMetricType() === 'AVG_AMOUNT'
        ) {
          const currencyService = new CurrencyService(this.dynamoDb)
          if (tx.destinationAmountDetails) {
            const converted = await currencyService.getTargetCurrencyAmount(
              tx.destinationAmountDetails,
              this.getTargetCurrency()
            )
            existing.receivingAmount =
              (existing.receivingAmount ?? 0) + converted.transactionAmount
          }
        }

        if (this.getMetricType() === 'ROUND_PERCENT') {
          const amt = tx.destinationAmountDetails?.transactionAmount
          if (amt != null && isRoundHundreds(amt)) {
            existing.roundCount = (existing.roundCount ?? 0) + 1
          }
        }

        timeAggregatedResult[dayKey] = existing
      }
    }

    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  protected getRuleAggregationVersion(): number {
    return 1
  }

  override getAggregationGranularity():
    | 'minute'
    | 'hour'
    | 'day'
    | 'month'
    | 'year'
    | 'week' {
    return 'day'
  }

  public async computeRule() {
    const [origin, destination] = await Promise.all([
      this.computeDirection('origin'),
      this.computeDirection('destination'),
    ])
    return {
      ruleHitResult: [origin, destination].filter(Boolean),
    }
  }

  /**
   * Statistical approach used by stddev anomaly rules (R-11, R-12, R-25, R-26)
   *
   * We need a distribution to compute a standard deviation. A single 30-day sum
   * or a single 90-day sum is just one value, so there’s no "spread" to measure.
   *
   * To build a meaningful distribution, we aggregate transactions per day:
   * - Baseline (90 days): compute a value per day (e.g., total amount, count,
   *   avg amount, or round-percentage), then compute baselineMean and
   *   baselineStd over these 90 daily values.
   * - Period (30 days): compute the same per-day values for the last 30 days and
   *   take their average as periodMean.
   *
   * The rule triggers when periodMean > baselineMean + 2 * baselineStd
   * (one-sided, detecting spikes). This gives a robust comparison of the recent
   * 30-day daily behavior against the historical 90-day daily behavior.
   */
  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<
    { dailyMap: Map<string, DailyMetrics>; currentAmount?: number } | undefined
  > {
    const { baselineDays } = this.getWindowDays()
    const metricType = this.getMetricType()

    if (!this.transaction?.timestamp) {
      return
    }

    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      { units: baselineDays, granularity: 'day', rollingBasis: false }
    )

    const dailyMap = new Map<string, DailyMetrics>()
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      // Process pre-aggregated data
      for (const data of userAggregationData) {
        const dayKey = data.hour
        const existing = dailyMap.get(dayKey) || { totalCount: 0 }

        if (metricType === 'AMOUNT' || metricType === 'AVG_AMOUNT') {
          existing.totalAmount =
            (existing.totalAmount ?? 0) +
            ((data.sendingAmount ?? 0) + (data.receivingAmount ?? 0))
        }

        existing.totalCount =
          (existing.totalCount ?? 0) +
          ((data.sendingCount ?? 0) + (data.receivingCount ?? 0))

        if (metricType === 'ROUND_PERCENT') {
          existing.roundCount =
            (existing.roundCount ?? 0) + (data.roundCount ?? 0)
        }

        dailyMap.set(dayKey, existing)
      }
    } else {
      // Fall back to raw data if no pre-aggregated data available
      const attributes: Array<keyof AuxiliaryIndexTransaction> = [
        'timestamp',
        'originAmountDetails',
        'destinationAmountDetails',
      ]

      for await (const batch of getTransactionUserPastTransactionsByDirectionGenerator(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow: { units: baselineDays, granularity: 'day' },
          checkDirection: 'all',
          filters: this.filters,
        },
        attributes
      )) {
        await this.addTransactionsBatchToDailyMap(
          dailyMap,
          direction,
          batch.sendingTransactions,
          true
        )
        await this.addTransactionsBatchToDailyMap(
          dailyMap,
          direction,
          batch.receivingTransactions,
          false
        )
      }
    }

    // Do not add current transaction to the map
    // This matches the test's expectation that current transaction
    // is not included in its own evaluation
    return { dailyMap }
  }

  private async computeDirection(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const { baselineDays, periodDays } = this.getWindowDays()

    if (!this.transaction?.timestamp) {
      return
    }

    const data = await this.getData(direction)
    if (!data) {
      return
    }

    const { dailyMap } = data
    const nowDayStart = dayjs(this.transaction.timestamp)
      .startOf('day')
      .valueOf()
    const periodStart = dayjs(this.transaction.timestamp)
      .subtract(periodDays, 'day')
      .startOf('day')
      .valueOf()
    const baselineStart = dayjs(this.transaction.timestamp)
      .subtract(baselineDays, 'day')
      .startOf('day')
      .valueOf()

    const baselineValues: number[] = []
    const periodValues: number[] = []

    // Process all days in a single pass, categorizing values directly
    for (const [dayKey, metrics] of dailyMap.entries()) {
      const dayTs = dayjs(dayKey, 'YYYY-MM-DD').valueOf()
      if (dayTs < baselineStart || dayTs > nowDayStart) {
        continue
      }

      const value = await this.computeMetricValue(metrics)

      // Categorize value directly into appropriate arrays
      if (dayTs >= baselineStart && dayTs <= nowDayStart) {
        baselineValues.push(value)
      }
      if (dayTs >= periodStart && dayTs <= nowDayStart) {
        periodValues.push(value)
      }
    }

    if (baselineValues.length === 0 || periodValues.length === 0) {
      return
    }

    const baselineMean = mean(baselineValues)
    const baselineStd = stddev(baselineValues, baselineMean)
    const periodMean = mean(periodValues)

    if (
      Number.isFinite(baselineMean) &&
      Number.isFinite(baselineStd) &&
      Number.isFinite(periodMean) &&
      periodMean > baselineMean + this.getStddevThreshold() * baselineStd
    ) {
      const vars: {
        baselineMean: number
        baselineStd: number
        periodMean: number
        metricType: MetricType
        currency?: CurrencyCode
      } = {
        baselineMean,
        baselineStd,
        periodMean,
        metricType: this.getMetricType(),
      }
      if (
        this.getMetricType() === 'AMOUNT' ||
        this.getMetricType() === 'AVG_AMOUNT'
      ) {
        vars.currency = this.getTargetCurrency()
      }
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars,
      }
    }

    return
  }

  private async addTransactionsBatchToDailyMap(
    dailyMap: Map<string, DailyMetrics>,
    _direction: 'origin' | 'destination',
    transactions: AuxiliaryIndexTransaction[],
    isSending: boolean
  ) {
    const metricType = this.getMetricType()
    const currencyService =
      metricType === 'AMOUNT' || metricType === 'AVG_AMOUNT'
        ? new CurrencyService(this.dynamoDb)
        : undefined
    const targetCurrency = this.getTargetCurrency()

    for (const t of transactions) {
      const ts = t.timestamp as number
      const dayKey = getTransactionStatsTimeGroupLabelV2(ts, 'day')
      const existing = dailyMap.get(dayKey) || { totalCount: 0 }

      existing.totalCount = (existing.totalCount ?? 0) + 1

      if (metricType === 'AMOUNT' || metricType === 'AVG_AMOUNT') {
        const amountDetails = isSending
          ? t.originAmountDetails
          : t.destinationAmountDetails
        if (amountDetails && currencyService) {
          const converted = await currencyService.getTargetCurrencyAmount(
            amountDetails,
            targetCurrency
          )
          existing.totalAmount =
            (existing.totalAmount ?? 0) + converted.transactionAmount
        }
      }

      if (metricType === 'ROUND_PERCENT') {
        const amountDetails = isSending
          ? t.originAmountDetails
          : t.destinationAmountDetails
        const amt = amountDetails?.transactionAmount
        if (amt != null) {
          if (isRoundHundreds(amt)) {
            existing.roundCount = (existing.roundCount ?? 0) + 1
          }
        }
      }

      dailyMap.set(dayKey, existing)
    }
  }

  private async computeMetricValue(metrics: DailyMetrics): Promise<number> {
    const metricType = this.getMetricType()
    if (metricType === 'COUNT') {
      return metrics.totalCount
    }
    if (metricType === 'AMOUNT') {
      return metrics.totalAmount ?? 0
    }
    if (metricType === 'AVG_AMOUNT') {
      if (!metrics.totalCount) {
        return 0
      }
      return (metrics.totalAmount ?? 0) / metrics.totalCount
    }
    if (!metrics.totalCount) {
      return 0
    }
    return (metrics.roundCount ?? 0) / metrics.totalCount
  }

  private getTimeRange(nowTs: number, days: number) {
    const before = dayjs(nowTs).endOf('day').valueOf()
    const after = dayjs(nowTs).subtract(days, 'day').startOf('day').valueOf()
    return { afterTimestamp: after, beforeTimestamp: before }
  }
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[], mu: number): number {
  if (values.length === 0) {
    return 0
  }
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mu, 2), 0) / values.length
  return Math.sqrt(variance)
}

function isRoundHundreds(amount: number): boolean {
  const cents = Math.round((amount - Math.trunc(amount)) * 100)
  if (cents !== 0) {
    return false
  }
  const integer = Math.trunc(amount)
  return integer % 100 === 0
}
