import { JSONSchemaType } from 'ajv'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import { AggregationRepository } from '../repositories/aggregation-repository'
import {
  CHECK_RECEIVER_SCHEMA,
  CHECK_SENDER_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { TimeGranularity } from '@/core/dynamodb/dynamodb-keys'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export type TransactionsVolumeQuantilesRuleParameters = {
  transactionVolumeThresholds: {
    DAILY?: { [currency: string]: number }
    MONTHLY?: { [currency: string]: number }
    YEARLY?: { [currency: string]: number }
  }
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
}

export default class TransactionsVolumeQuantilesRule extends TransactionRule<TransactionsVolumeQuantilesRuleParameters> {
  aggregationRepository?: AggregationRepository

  public static getSchema(): JSONSchemaType<TransactionsVolumeQuantilesRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThresholds: {
          type: 'object',
          properties: {
            DAILY: {
              type: 'object',
              title: 'Daily Transactions Volume Threshold',
              additionalProperties: {
                type: 'integer',
              },
              required: [],
              nullable: true,
            },
            MONTHLY: {
              type: 'object',
              title: 'Monthly Transactions Volume Threshold',
              additionalProperties: {
                type: 'integer',
              },
              required: [],
              nullable: true,
            },
            YEARLY: {
              type: 'object',
              title: 'Yearly Transactions Volume Threshold',
              additionalProperties: {
                type: 'integer',
              },
              required: [],
              nullable: true,
            },
          },
        },
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
      },
      required: ['transactionVolumeThresholds'],
    }
  }

  public async computeRule() {
    const results = await this.computeResults()
    if (results == null) {
      return undefined
    }
    const { isSenderHit, isReceiverHit } = results
    if (isSenderHit || isReceiverHit) {
      const { timeGranularity, amount } = results
      const { transactionVolumeThresholds } = this.parameters
      let volumeDelta
      let volumeThreshold
      let transactionVolumeThreshold
      if (timeGranularity === 'day') {
        transactionVolumeThreshold = transactionVolumeThresholds.DAILY
      } else if (timeGranularity === 'month') {
        transactionVolumeThreshold = transactionVolumeThresholds.MONTHLY
      } else if (timeGranularity === 'year') {
        transactionVolumeThreshold = transactionVolumeThresholds.YEARLY
      }

      if (
        amount != null &&
        transactionVolumeThreshold?.[amount.transactionCurrency] != null
      ) {
        volumeDelta = {
          transactionAmount:
            amount.transactionAmount -
            transactionVolumeThreshold?.[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
        volumeThreshold = {
          transactionAmount:
            transactionVolumeThreshold?.[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
      } else {
        volumeDelta = null
        volumeThreshold = null
      }

      const hitResult: RuleHitResult = []
      if (results?.isSenderHit) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: {
            ...super.getTransactionVars('origin'),
            volumeDelta,
            volumeThreshold,
          },
        })
      }
      if (results?.isReceiverHit) {
        hitResult.push({
          direction: 'DESTINATION',
          vars: {
            ...super.getTransactionVars('destination'),
            volumeDelta,
            volumeThreshold,
          },
        })
      }
      return hitResult
    }
  }

  private async computeResults() {
    const { transactionVolumeThresholds } = this.parameters
    this.aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const results = await Promise.all([
      this.computeRuleByTimeGranularity(
        'day',
        transactionVolumeThresholds.DAILY
      ),
      this.computeRuleByTimeGranularity(
        'month',
        transactionVolumeThresholds.MONTHLY
      ),
      this.computeRuleByTimeGranularity(
        'year',
        transactionVolumeThresholds.YEARLY
      ),
    ])
    // return { dailyResult, monthlyResult, yearlyResult }
    for (const result of results) {
      if (result.isReceiverHit || result.isSenderHit) {
        return result
      }
    }
    return undefined
  }

  private async computeRuleByTimeGranularity(
    timeGranularity: TimeGranularity,
    threshold: { [currency: string]: number } | undefined
  ): Promise<{
    isSenderHit: boolean
    isReceiverHit: boolean
    amount: TransactionAmountDetails | null
    timeGranularity: TimeGranularity
  }> {
    if (!threshold) {
      return {
        isSenderHit: false,
        isReceiverHit: false,
        amount: null,
        timeGranularity: timeGranularity,
      }
    }
    const { checkSender, checkReceiver } = this.parameters
    const aggregationRepository = this
      .aggregationRepository as AggregationRepository
    const [senderTransactionsVolume, receiverTransactionsVolume] =
      await Promise.all([
        this.transaction.originUserId && checkSender !== 'none'
          ? aggregationRepository.getUserTransactionsVolumeQuantile(
              this.transaction.originUserId,
              this.transaction.timestamp!,
              timeGranularity
            )
          : null,
        this.transaction.destinationUserId && checkReceiver !== 'none'
          ? aggregationRepository.getUserTransactionsVolumeQuantile(
              this.transaction.destinationUserId,
              this.transaction.timestamp!,
              timeGranularity
            )
          : null,
      ])

    // Sum up the transactions amount
    const senderTargetCurrency =
      senderTransactionsVolume?.sendingTransactionsVolume
        ?.transactionCurrency ||
      this.transaction.originAmountDetails?.transactionCurrency
    const senderSendingAmount = await getTransactionsTotalAmount(
      [
        senderTransactionsVolume?.sendingTransactionsVolume,
        this.transaction.originAmountDetails,
      ],
      senderTargetCurrency as CurrencyCode
    )
    const senderReceivingAmount =
      senderTransactionsVolume?.receivingTransactionsVolume
    const receiverSendingAmount =
      receiverTransactionsVolume?.sendingTransactionsVolume
    const receiverTargetCurrency =
      receiverTransactionsVolume?.receivingTransactionsVolume
        ?.transactionCurrency ||
      this.transaction.destinationAmountDetails?.transactionCurrency
    const receiverReceivingAmount = await getTransactionsTotalAmount(
      [
        receiverTransactionsVolume?.receivingTransactionsVolume,
        this.transaction.destinationAmountDetails,
      ],
      receiverTargetCurrency as CurrencyCode
    )

    const senderSum = senderReceivingAmount
      ? sumTransactionAmountDetails(senderSendingAmount, senderReceivingAmount)
      : senderSendingAmount
    const receiverSum = receiverSendingAmount
      ? sumTransactionAmountDetails(
          receiverSendingAmount,
          receiverReceivingAmount
        )
      : receiverReceivingAmount

    let isSenderHit = false
    let isReceiverHit = false
    let amount: TransactionAmountDetails | null = null

    if (
      checkSender === 'sending' &&
      (await isTransactionAmountAboveThreshold(senderSendingAmount, threshold))
        .isHit
    ) {
      isSenderHit = true
      amount = senderSendingAmount
    } else if (
      checkSender === 'all' &&
      (await isTransactionAmountAboveThreshold(senderSum, threshold)).isHit
    ) {
      isSenderHit = true
      amount = senderSum
    }
    if (
      checkReceiver === 'receiving' &&
      (
        await isTransactionAmountAboveThreshold(
          receiverReceivingAmount,
          threshold
        )
      ).isHit
    ) {
      isReceiverHit = true
      amount = receiverReceivingAmount
    } else if (
      checkReceiver === 'all' &&
      (await isTransactionAmountAboveThreshold(receiverSum, threshold)).isHit
    ) {
      isReceiverHit = true
      amount = receiverSum
    }
    return { isSenderHit, isReceiverHit, amount, timeGranularity }
  }
}
