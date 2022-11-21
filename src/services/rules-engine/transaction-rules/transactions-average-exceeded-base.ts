import _ from 'lodash'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  TIME_WINDOW_SCHEMA,
  TimeWindow,
} from '../utils/rule-parameter-schemas'
import { TransactionFilters } from '../transaction-filters'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactions,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '@/services/rules-engine/repositories/transaction-repository'
import {
  getTimestampRange,
  toGranularity,
} from '@/services/rules-engine/utils/time-utils'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RuleResult } from '@/services/rules-engine/rule'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { neverThrow } from '@/utils/lang'
import { ExtendedJSONSchemaType } from '@/services/rules-engine/utils/rule-schema-utils'
import { multiplierToPercents } from '@/services/rules-engine/utils/math-utils'
import { logger } from '@/core/logger'

type UserParty = 'origin' | 'destination'

type AggregationData = {
  count?: number
  amount?: number
}

export type TransactionsAverageExceededParameters = {
  period1: TimeWindow
  period2: TimeWindow
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

export default class TransactionAverageExceededBaseRule<
  Params extends TransactionsAverageExceededParameters
> extends TransactionAggregationRule<
  Params,
  TransactionFilters,
  AggregationData
> {
  transactionRepository?: TransactionRepository

  public static getBaseSchema(): ExtendedJSONSchemaType<TransactionsAverageExceededParameters> {
    return {
      type: 'object',
      properties: {
        period1: TIME_WINDOW_SCHEMA({
          title: 'period1 (Current period)',
        }),
        period2: TIME_WINDOW_SCHEMA({
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

  protected getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  } {
    throw new Error('Not implemented')
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' {
    throw new Error('Not implemented')
  }

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
    const period1TransactionsCount = period1AmountDetails.length
    const period2TransactionsCount = period2AmountDetails.length

    if (
      (period1TransactionsNumberMin &&
        period1TransactionsCount < period1TransactionsNumberMin) ||
      (period1TransactionsNumberMax &&
        period1TransactionsCount > period1TransactionsNumberMax)
    ) {
      return
    }
    if (
      (period2TransactionsNumberMin &&
        period2TransactionsCount < period2TransactionsNumberMin) ||
      (period2TransactionsNumberMax &&
        period2TransactionsCount > period2TransactionsNumberMax)
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

      result = await Promise.all([
        avgTransactionAmount(amountDetails1, currency, units1),
        avgTransactionAmount(amountDetails2, currency, units2),
      ])
    } else if (avgMethod === 'NUMBER') {
      const { units1, units2 } = this.getPeriodUnits()
      result = [
        period1TransactionsCount / units1,
        period2TransactionsCount / units2,
      ]
    } else {
      throw neverThrow(avgMethod, `Method not supported: ${avgMethod}`)
    }

    if (
      (avgMin != null && result[0] < avgMin) ||
      (avgMax != null && result[0] > avgMax)
    ) {
      return
    }

    return result
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    const {
      checkSender,
      checkReceiver,
      period1,
      period2,
      excludePeriod1,
      averageThreshold,
    } = this.parameters
    const { min: avgMin, max: avgMax } = averageThreshold ?? {}
    const directions: Array<'origin' | 'destination'> = []
    if (checkSender !== 'none') {
      directions.push('origin')
    }
    if (checkReceiver !== 'none') {
      directions.push('destination')
    }
    let missingAggregation = false
    for (const direction of directions) {
      const {
        afterTimestamp: afterTimestampP1,
        beforeTimestamp: beforeTimestampP1,
      } = getTimestampRange(this.transaction.timestamp!, period1)
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
      if (!userAggregationDataP1 && !userAggregationDataP2) {
        missingAggregation = true
        break
      }
      const avgMethod = this.getAvgMethod()
      const { units1, units2 } = this.getPeriodUnits()
      let avg1 = 0
      let avg2 = 0
      if (avgMethod === 'NUMBER') {
        avg1 =
          (_.sumBy(userAggregationDataP1, (data) => data.count!) + 1) / units1
        avg2 =
          (_.sumBy(userAggregationDataP2, (data) => data.count!) +
            (excludePeriod1 ? 0 : 1)) /
          units2
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
        avg1 =
          (_.sumBy(userAggregationDataP1, (data) => data.amount!) +
            currentAmount) /
          units1
        avg2 =
          (_.sumBy(userAggregationDataP2, (data) => data.amount!) +
            (excludePeriod1 ? 0 : currentAmount)) /
          units2
      }

      const multiplier = avg1 / avg2
      const { value: maxMultiplier, currency } = this.getMultiplierThresholds()
      const result = multiplierToPercents(multiplier) > maxMultiplier
      const isWithinAvgThresholds =
        (!avgMin || avg1 >= avgMin) && (!avgMax || avg1 <= avgMax)
      if (result && isWithinAvgThresholds) {
        const vars = {
          ...super.getTransactionVars(direction),
          period1,
          period2,
          multiplier,
          user: direction,
          currency,
        }
        return {
          action: this.action,
          vars,
        }
      }
    }

    if (missingAggregation) {
      return this.computeRuleExpensive()
    }
  }

  public async computeRuleExpensive(): Promise<RuleResult | undefined> {
    logger.info('Running expensive path...')

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const { period1, period2, checkSender, checkReceiver } = this.parameters

    const toCheck: UserParty[] = []
    if (checkSender !== 'none') {
      toCheck.push('origin')
    }
    if (checkReceiver !== 'none') {
      toCheck.push('destination')
    }

    const {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow: period2,
        checkSender,
        checkReceiver,
        transactionState: this.filters.transactionState,
        transactionTypes: this.filters.transactionTypes,
        paymentMethod: this.filters.paymentMethod,
      },
      ['timestamp', 'originAmountDetails', 'destinationAmountDetails']
    )
    const senderAmountDetailsP1 = this.getPeriod1Transactions(
      senderSendingTransactions.concat(this.transaction)
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod1Transactions(senderReceivingTransactions).map(
          (transaction) => transaction.destinationAmountDetails
        )
      )
    const receiverAmountDetailsP1 = this.getPeriod1Transactions(
      receiverSendingTransactions
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod1Transactions(
          receiverReceivingTransactions.concat(this.transaction)
        ).map((transaction) => transaction.destinationAmountDetails)
      )
    const senderAmountDetailsP2 = this.getPeriod2Transactions(
      senderSendingTransactions.concat(this.transaction)
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod2Transactions(senderReceivingTransactions).map(
          (transaction) => transaction.destinationAmountDetails
        )
      )
    const receiverAmountDetailsP2 = this.getPeriod2Transactions(
      receiverSendingTransactions
    )
      .map((transaction) => transaction.originAmountDetails)
      .concat(
        this.getPeriod2Transactions(
          receiverReceivingTransactions.concat(this.transaction)
        ).map((transaction) => transaction.destinationAmountDetails)
      )

    // Update aggregations
    await Promise.all([
      this.parameters.checkSender !== 'none'
        ? this.refreshRuleAggregations(
            'origin',
            await this.getTimeAggregatedResult(
              senderSendingTransactions,
              senderReceivingTransactions
            )
          )
        : Promise.resolve(),
      this.parameters.checkReceiver !== 'none'
        ? this.refreshRuleAggregations(
            'destination',
            await this.getTimeAggregatedResult(
              receiverSendingTransactions,
              receiverReceivingTransactions
            )
          )
        : Promise.resolve(),
    ])

    const { currency, value: maxMultiplier } = this.getMultiplierThresholds()
    for (const userParty of toCheck) {
      const period1AmountDetails =
        userParty === 'origin' ? senderAmountDetailsP1 : receiverAmountDetailsP1
      const period2AmountDetails =
        userParty === 'origin' ? senderAmountDetailsP2 : receiverAmountDetailsP2
      const avgs = await this.avg(
        period1AmountDetails,
        period2AmountDetails,
        currency
      )
      if (avgs == null) {
        return
      }
      const [avg1, avg2] = avgs
      const multiplier = avg1 / avg2
      const result = multiplierToPercents(multiplier) > maxMultiplier
      if (result) {
        const vars = {
          ...super.getTransactionVars(userParty),
          period1,
          period2,
          multiplier,
          user: userParty,
          currency,
        }
        return {
          action: this.action,
          vars,
        }
      }
    }

    return undefined
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
      ? toGranularity(period2, period1.granularity).units - period1.units
      : period2.units
    return {
      units1,
      units2,
    }
  }

  protected async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData> {
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
}

async function avgTransactionAmount(
  details: TransactionAmountDetails[],
  currency: CurrencyCode,
  units: number
): Promise<number> {
  if (details.length === 0) {
    return 0
  }

  const normalizedAmounts = await Promise.all(
    details.map((amountDetails) =>
      getTargetCurrencyAmount(amountDetails, currency)
    )
  )

  const sum = normalizedAmounts.reduce((acc, x) => acc + x.transactionAmount, 0)
  return sum / units
}
