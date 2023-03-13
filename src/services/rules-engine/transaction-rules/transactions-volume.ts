import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
  isTransactionAmountAboveThreshold,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
  INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import { getNonUserReceiverKeys, getNonUserSenderKeys } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

type AggregationData = {
  sendingCount?: number
  sendingAmount?: number
  receivingCount?: number
  receivingAmount?: number
}

export type TransactionsVolumeRuleParameters = {
  initialTransactions?: number
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  timeWindow: TimeWindow
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  matchPaymentMethodDetails?: boolean
}

export default class TransactionsVolumeRule extends TransactionAggregationRule<
  TransactionsVolumeRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TransactionsVolumeRuleParameters> {
    return {
      type: 'object',
      properties: {
        initialTransactions: INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA(),
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions volume threshold',
        }),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        matchPaymentMethodDetails:
          MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA(),
      },
      required: ['transactionVolumeThreshold', 'timeWindow'],
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
    const {
      checkSender,
      checkReceiver,
      initialTransactions,
      transactionVolumeThreshold,
    } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    const { totalAmount, totalCount } = await this.getData(direction)

    if (initialTransactions && totalCount <= initialTransactions) {
      return
    }

    const result = await isTransactionAmountAboveThreshold(
      totalAmount,
      transactionVolumeThreshold
    )
    if (!result.isHit) {
      return
    }

    let volumeDelta
    let volumeThreshold
    if (
      totalAmount != null &&
      transactionVolumeThreshold[totalAmount.transactionCurrency] != null
    ) {
      volumeDelta = {
        transactionAmount:
          totalAmount.transactionAmount -
          transactionVolumeThreshold[totalAmount.transactionCurrency],
        transactionCurrency: totalAmount.transactionCurrency,
      }
      volumeThreshold = {
        transactionAmount:
          transactionVolumeThreshold[totalAmount.transactionCurrency],
        transactionCurrency: totalAmount.transactionCurrency,
      }
    } else {
      volumeDelta = null
      volumeThreshold = null
    }

    let falsePositiveDetails
    if (this.ruleInstance.falsePositiveCheckEnabled) {
      if (
        volumeDelta != null &&
        totalAmount != null &&
        volumeDelta.transactionAmount / totalAmount.transactionAmount < 0.05
      ) {
        falsePositiveDetails = {
          isFalsePositive: true,
          confidenceScore: _.random(60, 80),
        }
      }
    }

    return {
      direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
      vars: {
        ...super.getTransactionVars(direction),
        volumeDelta,
        volumeThreshold,
      },
      falsePositiveDetails: falsePositiveDetails,
    }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<{ totalAmount: TransactionAmountDetails; totalCount: number }> {
    const {
      checkSender,
      checkReceiver,
      transactionVolumeThreshold,
      timeWindow,
      matchPaymentMethodDetails,
    } = this.parameters

    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      const checkDirection =
        direction === 'origin' ? checkSender : checkReceiver
      const totalCount = _.sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingCount
            : checkDirection === 'receiving'
            ? data.receivingCount
            : (data.sendingCount ?? 0) + (data.receivingCount ?? 0)) ?? 0
      )
      const totalAmount = _.sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingAmount
            : checkDirection === 'receiving'
            ? data.receivingAmount
            : (data.sendingAmount ?? 0) + (data.receivingAmount ?? 0)) ?? 0
      )
      const currentAmountDetails =
        direction === 'origin'
          ? this.transaction.originAmountDetails
          : this.transaction.destinationAmountDetails
      const currentAmount =
        currentAmountDetails &&
        (await getTargetCurrencyAmount(
          currentAmountDetails,
          this.getTargetCurrency()
        ))
      return {
        totalCount: totalCount + 1,
        totalAmount: {
          transactionAmount:
            totalAmount + (currentAmount ? currentAmount.transactionAmount : 0),
          transactionCurrency: this.getTargetCurrency(),
        },
      }
    }

    // Fallback
    let { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow,
          checkDirection:
            (direction === 'origin' ? checkSender : checkReceiver) ?? 'all',
          transactionStates: this.filters.transactionStatesHistorical,
          transactionTypes: this.filters.transactionTypesHistorical,
          paymentMethod: this.filters.paymentMethodHistorical,
          countries: this.filters.transactionCountriesHistorical,
          matchPaymentMethodDetails,
        },
        [
          'timestamp',
          'originUserId',
          'destinationUserId',
          'originAmountDetails',
          'destinationAmountDetails',
        ]
      )

    if (matchPaymentMethodDetails) {
      const targetUserId =
        direction === 'origin'
          ? this.transaction.originUserId
          : this.transaction.destinationUserId
      sendingTransactions = sendingTransactions.filter(
        (transaction) => transaction.originUserId === targetUserId
      )
      receivingTransactions = receivingTransactions.filter(
        (transaction) => transaction.destinationUserId === targetUserId
      )
    }

    // Update aggregations
    await this.refreshRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(
        sendingTransactions,
        receivingTransactions
      )
    )

    // Sum up the transactions amount
    const targetCurrency = Object.keys(
      transactionVolumeThreshold
    )[0] as CurrencyCode

    if (direction === 'origin') {
      sendingTransactions.push(this.transaction)
    } else {
      receivingTransactions.push(this.transaction)
    }
    const sendingAmount = await getTransactionsTotalAmount(
      sendingTransactions.map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    const receivingAmount = await getTransactionsTotalAmount(
      receivingTransactions.map(
        (transaction) => transaction.destinationAmountDetails
      ),
      targetCurrency
    )

    const totalAmount = sumTransactionAmountDetails(
      sendingAmount,
      receivingAmount
    )
    return {
      totalAmount,
      totalCount: sendingTransactions.length + receivingTransactions.length,
    }
  }

  private getTargetCurrency(): CurrencyCode {
    return Object.keys(
      this.parameters.transactionVolumeThreshold
    )[0] as CurrencyCode
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return _.merge(
      groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
          sendingAmount: (
            await getTransactionsTotalAmount(
              group.map((t) => t.originAmountDetails),
              this.getTargetCurrency()
            )
          ).transactionAmount,
        })
      ),
      groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          receivingCount: group.length,
          receivingAmount: (
            await getTransactionsTotalAmount(
              group.map((t) => t.destinationAmountDetails),
              this.getTargetCurrency()
            )
          ).transactionAmount,
        })
      )
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    const targetAmountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    if (!targetAmountDetails) {
      return null
    }
    const targetAmount = await getTargetCurrencyAmount(
      targetAmountDetails,
      this.getTargetCurrency()
    )
    const result = targetAggregationData ?? {}
    if (direction === 'origin') {
      result.sendingCount = (result.sendingCount ?? 0) + 1
      result.sendingAmount =
        (result.sendingAmount ?? 0) + targetAmount.transactionAmount
    } else {
      result.receivingCount = (result.receivingCount ?? 0) + 1
      result.receivingAmount =
        (result.receivingAmount ?? 0) + targetAmount.transactionAmount
    }
    return result
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  override getRuleAggregationVersion(): number {
    return 1
  }

  override getUserKeyId(direction: 'origin' | 'destination') {
    if (this.parameters.matchPaymentMethodDetails) {
      const nonUserKey =
        direction === 'origin'
          ? getNonUserSenderKeys(
              this.tenantId,
              this.transaction,
              undefined,
              true
            )?.PartitionKeyID
          : getNonUserReceiverKeys(
              this.tenantId,
              this.transaction,
              undefined,
              true
            )?.PartitionKeyID
      if (nonUserKey) {
        return direction === 'origin'
          ? `${nonUserKey}-${this.transaction.originUserId}`
          : `${nonUserKey}-${this.transaction.destinationUserId}`
      }
      return
    }
    return super.getUserKeyId(direction)
  }
}
