import { JSONSchemaType } from 'ajv'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { isUserType } from '../utils/user-rule-utils'
import { TransactionRule } from './rule'
import { TimeGranularity } from '@/core/dynamodb/dynamodb-keys'
import { UserType } from '@/@types/user/user-type'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

export type TransactionsVolumeQuantilesRuleParameters = {
  transactionVolumeThresholds: {
    DAILY?: { [currency: string]: number }
    MONTHLY?: { [currency: string]: number }
    YEARLY?: { [currency: string]: number }
  }
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  userType?: UserType
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
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'],
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
        },
        userType: {
          type: 'string',
          title: 'Type of user',
          enum: ['CONSUMER', 'BUSINESS'],
          nullable: true,
        },
      },
      required: ['transactionVolumeThresholds'],
    }
  }

  public getFilters() {
    const { userType } = this.parameters
    return [() => isUserType(this.senderUser, userType)]
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

      let direction: 'origin' | 'destination' | null = null
      if (results?.isSenderHit) {
        direction = 'origin'
      } else if (results?.isReceiverHit) {
        direction = 'destination'
      }

      const vars = {
        ...super.getTransactionVars(direction),
        volumeDelta,
        volumeThreshold,
      }

      return { action: this.action, vars }
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
      senderTargetCurrency as string
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
      receiverTargetCurrency as string
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
    ) {
      isSenderHit = true
      amount = senderSendingAmount
    } else if (
      checkSender === 'all' &&
      (await isTransactionAmountAboveThreshold(senderSum, threshold))
    ) {
      isSenderHit = true
      amount = senderSum
    }
    if (
      checkReceiver === 'receiving' &&
      (await isTransactionAmountAboveThreshold(
        receiverReceivingAmount,
        threshold
      ))
    ) {
      isReceiverHit = true
      amount = receiverReceivingAmount
    } else if (
      checkReceiver === 'all' &&
      (await isTransactionAmountAboveThreshold(receiverSum, threshold))
    ) {
      isReceiverHit = true
      amount = receiverSum
    }
    return { isSenderHit, isReceiverHit, amount, timeGranularity }
  }
}
