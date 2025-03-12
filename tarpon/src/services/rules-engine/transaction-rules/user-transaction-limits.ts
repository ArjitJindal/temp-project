import { JSONSchemaType } from 'ajv'
import { groupBy, isEmpty, memoize, random } from 'lodash'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
} from '../utils/transaction-rule-utils'
import { RuleHitResultItem } from '../rule'
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
import { traceable } from '@/core/xray'

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

@traceable
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
    return await Promise.all([
      this.computeRuleUser('origin'),
      this.computeRuleUser('destination'),
    ])
  }

  protected async computeRuleUser(
    direction: 'origin' | 'destination'
  ): Promise<RuleHitResultItem | undefined> {
    const user = direction === 'origin' ? this.senderUser : this.receiverUser
    const transactionAmountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    const transactionPaymentDetails =
      direction === 'origin'
        ? this.transaction.originPaymentDetails
        : this.transaction.destinationPaymentDetails

    if (!user?.transactionLimits || !transactionAmountDetails) {
      return
    }

    if (this.parameters.transactionsCountThreshold) {
      const timeRange = {
        beforeTimestamp: this.transaction.timestamp,
        afterTimestamp: subtractTime(
          dayjs(this.transaction.timestamp),
          this.parameters.transactionsCountThreshold.timeWindow
        ),
      }
      const sendingTransactionsCount =
        await this.transactionRepository.getGenericUserSendingTransactionsCount(
          user.userId,
          transactionPaymentDetails,
          timeRange,
          {
            ...(this.parameters?.onlyCheckTypes?.includes('PAYMENT_METHOD') &&
            this.transaction.originPaymentDetails?.method
              ? {
                  originPaymentMethods: [
                    this.transaction.originPaymentDetails.method,
                  ],
                }
              : {}),
          }
        )
      const receivingTransactionsCount =
        await this.transactionRepository.getGenericUserReceivingTransactionsCount(
          user.userId,
          transactionPaymentDetails,
          timeRange,
          {
            ...(this.parameters?.onlyCheckTypes?.includes('PAYMENT_METHOD') &&
            this.transaction.destinationPaymentDetails?.method
              ? {
                  originPaymentMethods: [
                    this.transaction.destinationPaymentDetails.method,
                  ],
                }
              : {}),
          }
        )

      if (
        sendingTransactionsCount + receivingTransactionsCount + 1 <=
        this.parameters.transactionsCountThreshold.threshold
      ) {
        return
      }
    }

    const { onlyCheckTypes } = this.parameters
    const {
      maximumDailyTransactionLimit,
      maximumMonthlyTransactionLimit,
      maximumWeeklyTransactionLimit,
      maximumYearlyTransactionLimit,
      maximumTransactionLimit,
      paymentMethodLimits,
    } = user.transactionLimits
    const totalLimits = [
      { limit: maximumDailyTransactionLimit, granularity: 'day' },
      { limit: maximumWeeklyTransactionLimit, granularity: 'week' },
      { limit: maximumMonthlyTransactionLimit, granularity: 'month' },
      { limit: maximumYearlyTransactionLimit, granularity: 'year' },
    ].filter((item) => item.limit) as Array<{
      limit: Amount
      granularity: 'day' | 'week' | 'month' | 'year'
    }>
    const transactionLimitResults: any[] = []

    if (
      isEmpty(onlyCheckTypes) ||
      onlyCheckTypes?.includes('ALL_TRANSACTIONS')
    ) {
      // Check for maximum transaction limit
      if (maximumTransactionLimit) {
        transactionLimitResults.push(
          await this.checkMaximumTransactionLimit(
            direction,
            maximumTransactionLimit
          )
        )
      }

      // Check for total transaction limits by time granularity
      transactionLimitResults.push(
        ...(await this.checkTotalTransactionLimits(direction, totalLimits))
      )
    }

    if (isEmpty(onlyCheckTypes) || onlyCheckTypes?.includes('PAYMENT_METHOD')) {
      const paymentMethod =
        direction === 'origin'
          ? this.transaction.originPaymentDetails?.method
          : this.transaction.destinationPaymentDetails?.method
      // Check for payment method transaction limits by time granularity
      if (paymentMethod && paymentMethodLimits?.[paymentMethod] !== undefined) {
        transactionLimitResults.push(
          ...(await this.checkPaymentMethodTransactionLimits(
            direction,
            paymentMethod,
            paymentMethodLimits?.[paymentMethod] ?? {}
          ))
        )
      }
    }

    const transactionLimitHitResults = transactionLimitResults.filter(Boolean)
    if (transactionLimitHitResults.length > 0) {
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: {
          hitDescription: transactionLimitHitResults
            .map((r) => r?.hitDescription)
            .join(' '),
        },
        falsePositiveDetails: transactionLimitHitResults.find(
          (r) => r?.falsePositiveDetails
        )?.falsePositiveDetails,
      }
    }
  }

  getStatsByGranularity = memoize(
    async (
      direction: 'origin' | 'destination',
      granularity: 'day' | 'week' | 'month' | 'year'
    ): Promise<UserTimeAggregationAttributes> => {
      const user = direction === 'origin' ? this.senderUser : this.receiverUser
      if (this.aggregationRepository) {
        const data =
          await this.aggregationRepository.getUserTransactionStatsTimeGroup(
            user?.userId ?? '',
            this.transaction.timestamp,
            granularity
          )
        return data
      }
      const afterTimestamp = dayjs(this.transaction.timestamp)
        .startOf(granularity)
        .valueOf()
      const [sendingTransactions, receivingTransactions] = await Promise.all([
        this.transactionRepository.getUserSendingTransactions(
          user?.userId ?? '',
          { afterTimestamp, beforeTimestamp: this.transaction.timestamp },
          { transactionStates: ['SUCCESSFUL'] },
          ['originAmountDetails']
        ),
        this.transactionRepository.getUserReceivingTransactions(
          user?.userId ?? '',
          { afterTimestamp, beforeTimestamp: this.transaction.timestamp },
          { transactionStates: ['SUCCESSFUL'] },
          ['destinationAmountDetails']
        ),
      ])
      const result: UserTimeAggregationAttributes = {
        sendingTransactionsAmount: new Map(),
        sendingTransactionsCount: new Map(),
        receivingTransactionsAmount: new Map(),
        receivingTransactionsCount: new Map(),
      }
      const targetCurrency =
        sendingTransactions.find((t) => t.originAmountDetails)
          ?.originAmountDetails?.transactionCurrency ??
        receivingTransactions.find((t) => t.destinationAmountDetails)
          ?.destinationAmountDetails?.transactionCurrency ??
        'USD'
      const sendingCount = sendingTransactions.length
      const receivingCount = receivingTransactions.length
      const sendingAmount = await getTransactionsTotalAmount(
        sendingTransactions.map((t) => t.originAmountDetails),
        targetCurrency,
        this.dynamoDb
      )
      const receivingAmount = await getTransactionsTotalAmount(
        receivingTransactions.map((t) => t.destinationAmountDetails),
        targetCurrency,
        this.dynamoDb
      )
      result.sendingTransactionsAmount.set('ALL', sendingAmount)
      result.sendingTransactionsCount.set('ALL', sendingCount)
      result.receivingTransactionsAmount.set('ALL', receivingAmount)
      result.receivingTransactionsCount.set('ALL', receivingCount)
      const sendingGroups = groupBy(
        sendingTransactions,
        (transaction) => transaction.originPaymentDetails?.method
      )
      const receivingGroups = groupBy(
        receivingTransactions,
        (transaction) => transaction.destinationPaymentDetails?.method
      )
      for (const paymentMethod in sendingGroups) {
        if (paymentMethod) {
          const totalCount = sendingGroups[paymentMethod].length
          const totalAmount = await getTransactionsTotalAmount(
            sendingTransactions.map((t) => t.originAmountDetails),
            targetCurrency,
            this.dynamoDb
          )
          result.sendingTransactionsAmount.set(
            paymentMethod as PaymentMethod,
            totalAmount
          )
          result.sendingTransactionsCount.set(
            paymentMethod as PaymentMethod,
            totalCount
          )
        }
      }
      for (const paymentMethod in receivingGroups) {
        if (paymentMethod) {
          const totalCount = receivingGroups[paymentMethod].length
          const totalAmount = await getTransactionsTotalAmount(
            receivingTransactions.map((t) => t.destinationAmountDetails),
            targetCurrency,
            this.dynamoDb
          )
          result.receivingTransactionsAmount.set(
            paymentMethod as PaymentMethod,
            totalAmount
          )
          result.receivingTransactionsCount.set(
            paymentMethod as PaymentMethod,
            totalCount
          )
        }
      }
      return result
    },
    (...args) => args.join('_')
  )

  private async checkMaximumTransactionLimit(
    direction: 'origin' | 'destination',
    maximumTransactionLimit: Amount
  ): Promise<TransacdtionLimitHitResult> {
    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    const party = direction === 'origin' ? 'Sender' : 'Receiver'
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      amountDetails,
      {
        [maximumTransactionLimit.amountCurrency]: this.getLimit(
          maximumTransactionLimit.amountValue
        ),
      },
      this.dynamoDb
    )
    if (transactionAmountHit.isHit) {
      const { thresholdHit } = transactionAmountHit
      let falsePositiveDetails: any = undefined
      if (this.ruleInstance.falsePositiveCheckEnabled && thresholdHit != null) {
        if (
          amountDetails &&
          thresholdHit.min &&
          (amountDetails.transactionAmount - thresholdHit.min) /
            amountDetails.transactionAmount <
            0.05
        ) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: random(60, 80),
          }
        }
      }
      return {
        falsePositiveDetails,
        hitDescription: `${party} ${
          direction === 'origin' ? 'sent' : 'received'
        } a transaction amount of ${formatMoney(
          amountDetails
        )} more than the limit (${formatMoney(maximumTransactionLimit)}).`,
      }
    }
  }

  private async checkTotalTransactionLimits(
    direction: 'origin' | 'destination',
    limits: Array<{
      limit: Amount
      granularity: 'day' | 'week' | 'month' | 'year'
    }>
  ) {
    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    const transactionLimitResults: TransacdtionLimitHitResult[] = []
    for (const { limit, granularity } of limits) {
      const stats = await this.getStatsByGranularity(direction, granularity)
      const currentSendingTotalAmount =
        stats.sendingTransactionsAmount.get('ALL')
      const currentReceivingTotalAmount =
        stats.receivingTransactionsAmount.get('ALL')
      const totalAmount = await getTransactionsTotalAmount(
        [currentSendingTotalAmount, currentReceivingTotalAmount, amountDetails],
        amountDetails?.transactionCurrency ?? 'USD',
        this.dynamoDb
      )
      const hitInfo = await isTransactionAmountAboveThreshold(
        totalAmount,
        {
          [limit.amountCurrency]: this.getLimit(limit.amountValue),
        },
        this.dynamoDb
      )
      if (hitInfo.isHit) {
        transactionLimitResults.push({
          hitDescription: `${
            direction === 'origin' ? 'Sender' : 'Receiver'
          } reached the ${granularityToAdverb(
            granularity
          )} transaction amount limit (${formatMoney(limit)}).`,
        })
      }
    }
    return transactionLimitResults
  }

  private async checkPaymentMethodTransactionLimits(
    direction: 'origin' | 'destination',
    paymentMethod: PaymentMethod,
    transactionLimit: TransactionLimit
  ): Promise<TransacdtionLimitHitResult[]> {
    const amountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    const party = direction === 'origin' ? 'Sender' : 'Receiver'
    const transactionLimitResults: TransacdtionLimitHitResult[] = []
    if (transactionLimit.transactionAmountLimit) {
      for (const g in transactionLimit.transactionAmountLimit) {
        const granularity = g as keyof TransactionAmountLimit
        const limit = transactionLimit.transactionAmountLimit[granularity]
        if (limit) {
          const stats = await this.getStatsByGranularity(direction, granularity)
          const currentSendingAmount =
            stats.sendingTransactionsAmount.get(paymentMethod)
          const currentReceivingAmount =
            stats.receivingTransactionsAmount.get(paymentMethod)
          const totalAmount = await getTransactionsTotalAmount(
            [currentSendingAmount, currentReceivingAmount, amountDetails],
            amountDetails?.transactionCurrency ?? 'USD',
            this.dynamoDb
          )
          const hitInfo = await isTransactionAmountAboveThreshold(
            totalAmount,
            {
              [limit.amountCurrency]: this.getLimit(limit.amountValue),
            },
            this.dynamoDb
          )
          if (hitInfo.isHit) {
            transactionLimitResults.push({
              hitDescription: `${party} reached the ${granularityToAdverb(
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
            direction,
            granularity as keyof TransactionAmountLimit
          )
          const currentSendingAmount =
            stats.sendingTransactionsAmount.get(paymentMethod)
          const currentReceivingAmount =
            stats.receivingTransactionsAmount.get(paymentMethod)
          const totalAmount = await getTransactionsTotalAmount(
            [currentSendingAmount, currentReceivingAmount, amountDetails],
            amountDetails?.transactionCurrency ?? 'USD',
            this.dynamoDb
          )
          const currentSendingCount =
            stats.sendingTransactionsCount.get(paymentMethod) ?? 0
          const currentReceivingCount =
            stats.receivingTransactionsCount.get(paymentMethod) ?? 0
          const totalCount = currentSendingCount + currentReceivingCount + 1
          const averageAmount: TransactionAmountDetails = {
            ...totalAmount,
            transactionAmount: totalAmount.transactionAmount / totalCount,
          }

          const hitInfo = await isTransactionAmountAboveThreshold(
            averageAmount,
            {
              [limit.amountCurrency]: this.getLimit(limit.amountValue),
            },
            this.dynamoDb
          )
          if (hitInfo.isHit) {
            transactionLimitResults.push({
              hitDescription: `${party} reached the ${granularityToAdverb(
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
            direction,
            granularity as keyof TransactionCountLimit
          )
          const currentSendingCount =
            stats.sendingTransactionsCount.get(paymentMethod) ?? 0
          const currentReceivingCount =
            stats.receivingTransactionsCount.get(paymentMethod) ?? 0
          if (currentSendingCount + currentReceivingCount + 1 > limit) {
            transactionLimitResults.push({
              hitDescription: `${party} reached the ${granularityToAdverb(
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
