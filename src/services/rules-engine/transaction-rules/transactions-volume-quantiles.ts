import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  getTransactionsTotalAmount,
  isTransactionAmountAboveThreshold,
  sumTransactionAmountDetails,
} from '../utils/transaction-rule-utils'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { RuleResult, TransactionRule } from './rule'
import { TimeGranularity } from '@/core/dynamodb/dynamodb-keys'

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
              additionalProperties: {
                type: 'integer',
              },
              required: [],
              nullable: true,
            },
            MONTHLY: {
              type: 'object',
              additionalProperties: {
                type: 'integer',
              },
              required: [],
              nullable: true,
            },
            YEARLY: {
              type: 'object',
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
          enum: ['sending', 'all', 'none'],
        },
        checkReceiver: {
          type: 'string',
          enum: ['receiving', 'all', 'none'],
        },
      },
      required: ['transactionVolumeThresholds'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { transactionVolumeThresholds } = this.parameters
    this.aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const [dailyResult, monthlyResult, yearlyResult] = await Promise.all([
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
    return dailyResult || monthlyResult || yearlyResult
  }

  private async computeRuleByTimeGranularity(
    timeGranularity: TimeGranularity,
    threshold: { [currency: string]: number } | undefined
  ): Promise<RuleResult | undefined> {
    if (!threshold) {
      return
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

    if (
      (checkSender === 'sending' &&
        (await isTransactionAmountAboveThreshold(
          senderSendingAmount,
          threshold
        ))) ||
      (checkSender === 'all' &&
        (await isTransactionAmountAboveThreshold(
          senderReceivingAmount
            ? sumTransactionAmountDetails(
                senderSendingAmount,
                senderReceivingAmount
              )
            : senderSendingAmount,
          threshold
        ))) ||
      (checkReceiver === 'receiving' &&
        (await isTransactionAmountAboveThreshold(
          receiverReceivingAmount,
          threshold
        ))) ||
      (checkReceiver === 'all' &&
        (await isTransactionAmountAboveThreshold(
          receiverSendingAmount
            ? sumTransactionAmountDetails(
                receiverSendingAmount,
                receiverReceivingAmount
              )
            : receiverReceivingAmount,
          threshold
        )))
    ) {
      return { action: this.action }
    }
  }
}
