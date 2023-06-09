import * as _ from 'lodash'
import { JSONSchemaType } from 'ajv'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
} from '../utils/transaction-rule-utils'
import { RuleHitResult } from '../rule'
import { UserTimeAggregationAttributes } from '../repositories/aggregation-repository'
import { formatMoney } from '../utils/format-description'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  PERCENT_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { subtractTime } from '../utils/time-utils'
import { TransactionRule } from './rule'
import { Amount } from '@/@types/openapi-public/Amount'
import { FalsePositiveDetails } from '@/@types/openapi-public/FalsePositiveDetails'
import { TransactionLimit } from '@/@types/openapi-public/TransactionLimit'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { TransactionAmountLimit } from '@/@types/openapi-public/TransactionAmountLimit'
import { TransactionCountLimit } from '@/@types/openapi-public/TransactionCountLimit'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import dayjs from '@/utils/dayjs'

type CheckType = 'PAYMENT_METHOD' | 'ALL_TRANSACTIONS'
const CHECK_TYPES: Array<{ value: CheckType; label: string }> = [
  { value: 'PAYMENT_METHOD', label: 'Per payment method' },
  { value: 'ALL_TRANSACTIONS', label: 'All transactions' },
]

type TransacdtionLimitHitResult =
  | {
      hitDescription: string
      falsePositiveDetails?: FalsePositiveDetails
    }
  | undefined

function granularityToAdverb(granularity: 'day' | 'week' | 'month' | 'year') {
  switch (granularity) {
    case 'day':
      return 'daily'
    default:
      return `${granularity}ly`
  }
}

export type UserTransactionLimitsRuleParameter = {
  onlyCheckTypes?: CheckType[]
  transactionsCountThreshold?: {
    threshold: number
    timeWindow: TimeWindow
  }
  multiplierThreshold?: number
}

export default class UserTransactionLimitsRule extends TransactionRule<UserTransactionLimitsRuleParameter> {
  public static getSchema(): JSONSchemaType<UserTransactionLimitsRuleParameter> {
    return {
      type: 'object',
      properties: {
        onlyCheckTypes: {
          type: 'array',
          title: 'Only check against certain transaction limits',
          description:
            'If unspecified, all expected limits defined on user profile will be checked.',
          uniqueItems: true,
          items: {
            type: 'string',
            enum: CHECK_TYPES.map((v) => v.value),
            enumNames: CHECK_TYPES.map((v) => v.label),
          },
          nullable: true,
        },
        transactionsCountThreshold: {
          type: 'object',
          title: 'Transactions count threshold',
          description:
            'rule is hit when the number of transactions per time window is greater than the threshold',
          properties: {
            threshold: {
              type: 'integer',
              title: 'Threshold',
            },
            timeWindow: TIME_WINDOW_SCHEMA(),
          },
          required: ['threshold', 'timeWindow'],
          nullable: true,
        },
        multiplierThreshold: PERCENT_OPTIONAL_SCHEMA({
          title: 'Maximum multiplier (as a percentage)',
          description:
            'For example, specifying 200 (%) means that the rule will only be hit if the threshold is at least twice the expected limit.',
          maximum: 'NO_MAXIMUM',
        }),
      },
    }
  }

  private getLimit(value: number): number {
    return value * ((this.parameters.multiplierThreshold ?? 100) * 0.01)
  }

  public async computeRule() {
    if (
      !this.senderUser?.transactionLimits ||
      !this.transaction.originAmountDetails
    ) {
      return
    }

    if (this.parameters.transactionsCountThreshold) {
      const transactionsCount =
        await this.transactionRepository.getGenericUserSendingTransactionsCount(
          this.senderUser.userId,
          this.transaction.originPaymentDetails,
          {
            beforeTimestamp: this.transaction.timestamp,
            afterTimestamp: subtractTime(
              dayjs(this.transaction.timestamp),
              this.parameters.transactionsCountThreshold.timeWindow
            ),
          },
          {
            ...(this.parameters?.onlyCheckTypes?.includes('PAYMENT_METHOD') &&
            this.transaction.originPaymentDetails?.method
              ? {
                  originPaymentMethods: [
                    this.transaction.originPaymentDetails?.method,
                  ],
                }
              : {}),
          }
        )

      if (
        transactionsCount + 1 <=
        this.parameters.transactionsCountThreshold.threshold
      ) {
        return
      }
    }

    const { onlyCheckTypes } = this.parameters
    const paymentMethod = this.transaction.originPaymentDetails?.method
    const {
      maximumDailyTransactionLimit,
      maximumMonthlyTransactionLimit,
      maximumWeeklyTransactionLimit,
      maximumYearlyTransactionLimit,
      maximumTransactionLimit,
      paymentMethodLimits,
    } = this.senderUser.transactionLimits
    const totalLimits = [
      { limit: maximumDailyTransactionLimit, granularity: 'day' },
      { limit: maximumWeeklyTransactionLimit, granularity: 'week' },
      { limit: maximumMonthlyTransactionLimit, granularity: 'month' },
      { limit: maximumYearlyTransactionLimit, granularity: 'year' },
    ].filter((item) => item.limit) as Array<{
      limit: Amount
      granularity: 'day' | 'week' | 'month' | 'year'
    }>
    const transactionLimitResults = []

    if (
      _.isEmpty(onlyCheckTypes) ||
      onlyCheckTypes?.includes('ALL_TRANSACTIONS')
    ) {
      // Check for maximum transaction limit
      if (maximumTransactionLimit) {
        transactionLimitResults.push(
          await this.checkMaximumTransactionLimit(maximumTransactionLimit)
        )
      }

      // Check for total transaction limits by time granularity
      transactionLimitResults.push(
        ...(await this.checkTotalTransactionLimits(totalLimits))
      )
    }

    if (
      _.isEmpty(onlyCheckTypes) ||
      onlyCheckTypes?.includes('PAYMENT_METHOD')
    ) {
      // Check for payment method transaction limits by time granularity
      if (paymentMethod && paymentMethodLimits?.[paymentMethod]) {
        transactionLimitResults.push(
          ...(await this.checkPaymentMethodTransactionLimits(
            paymentMethod,
            paymentMethodLimits[paymentMethod]!
          ))
        )
      }
    }

    const transactionLimitHitResults = transactionLimitResults.filter(Boolean)
    const hitResult: RuleHitResult = []
    if (transactionLimitHitResults.length > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          hitDescription: transactionLimitHitResults
            .map((r) => r?.hitDescription)
            .join(' '),
        },
        falsePositiveDetails: transactionLimitHitResults.find(
          (r) => r?.falsePositiveDetails
        )?.falsePositiveDetails,
      })
    }
    return hitResult
  }

  getStatsByGranularity = _.memoize(
    async (
      granularity: 'day' | 'week' | 'month' | 'year'
    ): Promise<UserTimeAggregationAttributes> => {
      if (this.aggregationRepository) {
        return this.aggregationRepository.getUserTransactionStatsTimeGroup(
          this.senderUser!.userId,
          this.transaction.timestamp,
          granularity
        )
      }
      const afterTimestamp = dayjs(this.transaction.timestamp)
        .startOf(granularity)
        .valueOf()
      const transactions =
        await this.transactionRepository.getUserSendingTransactions(
          this.senderUser!.userId,
          { afterTimestamp, beforeTimestamp: this.transaction.timestamp },
          { transactionStates: ['SUCCESSFUL'] },
          []
        )
      const result: UserTimeAggregationAttributes = {
        transactionsAmount: new Map(),
        transactionsCount: new Map(),
      }
      const targetCurrency =
        transactions.find((t) => t.originAmountDetails)?.originAmountDetails
          ?.transactionCurrency || 'USD'
      const allCount = transactions.length
      const allAmount = await getTransactionsTotalAmount(
        transactions.map((t) => t.originAmountDetails),
        targetCurrency
      )
      result.transactionsAmount.set('ALL', allAmount)
      result.transactionsCount.set('ALL', allCount)
      const groups = _.groupBy(
        transactions,
        (transaction) => transaction.originPaymentDetails?.method
      )
      for (const paymentMethod in groups) {
        if (paymentMethod) {
          const totalCount = groups[paymentMethod].length
          const totalAmount = await getTransactionsTotalAmount(
            transactions.map((t) => t.originAmountDetails),
            targetCurrency
          )
          result.transactionsAmount.set(
            paymentMethod as PaymentMethod,
            totalAmount
          )
          result.transactionsCount.set(
            paymentMethod as PaymentMethod,
            totalCount
          )
        }
      }
      return result
    }
  )

  private async checkMaximumTransactionLimit(
    maximumTransactionLimit: Amount
  ): Promise<TransacdtionLimitHitResult> {
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      this.transaction.originAmountDetails,
      {
        [maximumTransactionLimit.amountCurrency]: this.getLimit(
          maximumTransactionLimit.amountValue
        ),
      }
    )
    if (transactionAmountHit.isHit) {
      const { thresholdHit } = transactionAmountHit
      let falsePositiveDetails = undefined
      if (this.ruleInstance.falsePositiveCheckEnabled && thresholdHit != null) {
        if (
          this.transaction.originAmountDetails &&
          thresholdHit.min &&
          (this.transaction.originAmountDetails.transactionAmount -
            thresholdHit.min) /
            this.transaction.originAmountDetails.transactionAmount <
            0.05
        ) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: _.random(60, 80),
          }
        }
      }
      return {
        falsePositiveDetails,
        hitDescription: `Sender sent a transaction amount of ${formatMoney(
          this.transaction.originAmountDetails!
        )} more than the limit (${formatMoney(maximumTransactionLimit)}).`,
      }
    }
  }

  private async checkTotalTransactionLimits(
    limits: Array<{
      limit: Amount
      granularity: 'day' | 'week' | 'month' | 'year'
    }>
  ) {
    const transactionLimitResults: TransacdtionLimitHitResult[] = []
    for (const { limit, granularity } of limits) {
      const stats = await this.getStatsByGranularity(granularity)
      const currentTotalAmount = stats.transactionsAmount.get('ALL')
      const totalAmount = await getTransactionsTotalAmount(
        [currentTotalAmount, this.transaction.originAmountDetails],
        this.transaction.originAmountDetails!.transactionCurrency
      )
      const hitInfo = await isTransactionAmountAboveThreshold(totalAmount, {
        [limit.amountCurrency]: this.getLimit(limit.amountValue),
      })
      if (hitInfo.isHit) {
        transactionLimitResults.push({
          hitDescription: `Sender reached the ${granularityToAdverb(
            granularity
          )} transaction amount limit (${formatMoney(limit)}).`,
        })
      }
    }
    return transactionLimitResults
  }

  private async checkPaymentMethodTransactionLimits(
    paymentMethod: PaymentMethod,
    transactionLimit: TransactionLimit
  ): Promise<TransacdtionLimitHitResult[]> {
    const transactionLimitResults: TransacdtionLimitHitResult[] = []
    if (transactionLimit.transactionAmountLimit) {
      for (const g in transactionLimit.transactionAmountLimit) {
        const granularity = g as keyof TransactionAmountLimit
        const limit = transactionLimit.transactionAmountLimit[granularity]
        if (limit) {
          const stats = await this.getStatsByGranularity(granularity)
          const currentTotalAmount = stats.transactionsAmount.get(paymentMethod)
          const totalAmount = await getTransactionsTotalAmount(
            [currentTotalAmount, this.transaction.originAmountDetails],
            this.transaction.originAmountDetails!.transactionCurrency
          )
          const hitInfo = await isTransactionAmountAboveThreshold(totalAmount, {
            [limit.amountCurrency]: this.getLimit(limit.amountValue),
          })
          if (hitInfo.isHit) {
            transactionLimitResults.push({
              hitDescription: `Sender reached the ${granularityToAdverb(
                granularity
              )} transaction amount limit (${formatMoney(
                limit
              )}) of ${paymentMethod} payment method.`,
            })
          }
        }
      }
    }
    if (transactionLimit.averageTransactionAmountLimit) {
      for (const g in transactionLimit.averageTransactionAmountLimit) {
        const granularity = g as keyof TransactionAmountLimit
        const limit =
          transactionLimit.averageTransactionAmountLimit[
            granularity as keyof TransactionAmountLimit
          ]
        if (limit) {
          const stats = await this.getStatsByGranularity(
            granularity as keyof TransactionAmountLimit
          )
          const currentTotalAmount = stats.transactionsAmount.get(paymentMethod)
          const totalAmount = await getTransactionsTotalAmount(
            [currentTotalAmount, this.transaction.originAmountDetails],
            this.transaction.originAmountDetails!.transactionCurrency
          )
          const currentTotalCount =
            stats.transactionsCount.get(paymentMethod) ?? 0
          const totalCount = currentTotalCount + 1
          const averageAmount: TransactionAmountDetails = {
            ...totalAmount,
            transactionAmount: totalAmount.transactionAmount / totalCount,
          }

          const hitInfo = await isTransactionAmountAboveThreshold(
            averageAmount,
            {
              [limit.amountCurrency]: this.getLimit(limit.amountValue),
            }
          )
          if (hitInfo.isHit) {
            transactionLimitResults.push({
              hitDescription: `Sender reached the ${granularityToAdverb(
                granularity
              )} average transaction amount limit (${formatMoney(
                limit
              )}) of ${paymentMethod} payment method.`,
            })
          }
        }
      }
    }
    if (transactionLimit.transactionCountLimit) {
      for (const g in transactionLimit.transactionCountLimit) {
        const granularity = g as keyof TransactionAmountLimit
        const limit =
          transactionLimit.transactionCountLimit[
            granularity as keyof TransactionCountLimit
          ]
        if (limit != null) {
          const stats = await this.getStatsByGranularity(
            granularity as keyof TransactionCountLimit
          )
          const currentTotalCount =
            stats.transactionsCount.get(paymentMethod) ?? 0
          if (currentTotalCount + 1 > limit) {
            transactionLimitResults.push({
              hitDescription: `Sender reached the ${granularityToAdverb(
                granularity
              )} transaction count limit (${limit}) of ${paymentMethod} payment method.`,
            })
          }
        }
      }
    }
    return transactionLimitResults
  }
}
