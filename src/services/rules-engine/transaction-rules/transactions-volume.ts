import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactions,
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
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

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

export default class TransactionsVolumeRule extends TransactionRule<
  TransactionsVolumeRuleParameters,
  TransactionHistoricalFilters
> {
  transactionRepository?: TransactionRepository

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
        matchPaymentMethodDetails: {
          type: 'boolean',
          title: 'Match payment method details',
          description:
            'Transactions will only be flagged if same payment details are used',
          nullable: true,
        },
      },
      required: ['transactionVolumeThreshold', 'timeWindow'],
    }
  }

  private async computeHits(): Promise<{
    isSenderHit: boolean
    isReceiverHit: boolean
    amount: TransactionAmountDetails | null
  }> {
    const {
      checkSender,
      checkReceiver,
      transactionVolumeThreshold,
      timeWindow,
      matchPaymentMethodDetails,
      initialTransactions,
    } = this.parameters

    this.transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    let {
      senderSendingTransactions,
      senderReceivingTransactions,
      receiverSendingTransactions,
      receiverReceivingTransactions,
    } = await getTransactionUserPastTransactions(
      this.transaction,
      this.transactionRepository,
      {
        timeWindow,
        checkSender,
        checkReceiver,
        transactionStates: this.filters.transactionStatesHistorical,
        transactionTypes: this.filters.transactionTypesHistorical,
        paymentMethod: this.filters.paymentMethodHistorical,
        matchPaymentMethodDetails,
        countries: this.filters.transactionCountriesHistorical,
      },
      [
        'originUserId',
        'destinationUserId',
        'originAmountDetails',
        'destinationAmountDetails',
      ]
    )

    if (matchPaymentMethodDetails) {
      senderSendingTransactions = senderSendingTransactions.filter(
        (transaction) =>
          transaction.originUserId === this.transaction.originUserId
      )
      senderReceivingTransactions = senderReceivingTransactions.filter(
        (transaction) =>
          transaction.destinationUserId === this.transaction.originUserId
      )
      receiverSendingTransactions = receiverSendingTransactions.filter(
        (transaction) =>
          transaction.originUserId === this.transaction.destinationUserId
      )
      receiverReceivingTransactions = receiverReceivingTransactions.filter(
        (transaction) =>
          transaction.destinationUserId === this.transaction.destinationUserId
      )
    }

    // Sum up the transactions amount
    const targetCurrency = Object.keys(
      transactionVolumeThreshold
    )[0] as CurrencyCode
    const senderSendingAmount = await getTransactionsTotalAmount(
      senderSendingTransactions
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      targetCurrency
    )
    const senderReceivingAmount = await getTransactionsTotalAmount(
      senderReceivingTransactions.map(
        (transaction) => transaction.destinationAmountDetails
      ),
      targetCurrency
    )
    const receiverSendingAmount = await getTransactionsTotalAmount(
      receiverSendingTransactions.map(
        (transaction) => transaction.originAmountDetails
      ),
      targetCurrency
    )
    const receiverReceivingAmount = await getTransactionsTotalAmount(
      receiverReceivingTransactions
        .concat(this.transaction)
        .map((transaction) => transaction.destinationAmountDetails),
      targetCurrency
    )

    const senderSum = sumTransactionAmountDetails(
      senderSendingAmount,
      senderReceivingAmount
    )

    const receiverSum = sumTransactionAmountDetails(
      receiverSendingAmount,
      receiverReceivingAmount
    )

    const skipCheckSender =
      initialTransactions &&
      senderSendingTransactions.length + senderReceivingTransactions.length <
        initialTransactions
    const skipCheckReceiver =
      initialTransactions &&
      receiverSendingTransactions.length +
        receiverReceivingTransactions.length <
        initialTransactions
    let isSenderHit = false
    let isReceiverHit = false
    let amount: TransactionAmountDetails | null = null
    if (
      !skipCheckSender &&
      checkSender === 'sending' &&
      (
        await isTransactionAmountAboveThreshold(
          senderSendingAmount,
          transactionVolumeThreshold
        )
      ).isHit
    ) {
      isSenderHit = true
      amount = senderSendingAmount
    } else if (
      !skipCheckSender &&
      checkSender === 'all' &&
      (
        await isTransactionAmountAboveThreshold(
          senderSum,
          transactionVolumeThreshold
        )
      ).isHit
    ) {
      isSenderHit = true
      amount = senderSum
    } else if (
      !skipCheckReceiver &&
      checkReceiver === 'receiving' &&
      (
        await isTransactionAmountAboveThreshold(
          receiverReceivingAmount,
          transactionVolumeThreshold
        )
      ).isHit
    ) {
      isReceiverHit = true
      amount = receiverReceivingAmount
    } else if (
      !skipCheckReceiver &&
      checkReceiver === 'all' &&
      (
        await isTransactionAmountAboveThreshold(
          receiverSum,
          transactionVolumeThreshold
        )
      ).isHit
    ) {
      isReceiverHit = true
      amount = receiverSum
    }

    return { isSenderHit, isReceiverHit, amount }
  }

  public async computeRule() {
    const { isSenderHit, isReceiverHit, amount } = await this.computeHits()
    if (isSenderHit || isReceiverHit) {
      const { transactionVolumeThreshold } = this.parameters
      let volumeDelta
      let volumeThreshold
      if (
        amount != null &&
        transactionVolumeThreshold[amount.transactionCurrency] != null
      ) {
        volumeDelta = {
          transactionAmount:
            amount.transactionAmount -
            transactionVolumeThreshold[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
        volumeThreshold = {
          transactionAmount:
            transactionVolumeThreshold[amount.transactionCurrency],
          transactionCurrency: amount.transactionCurrency,
        }
      } else {
        volumeDelta = null
        volumeThreshold = null
      }

      let falsePositiveDetails
      if (this.ruleInstance.falsePositiveCheckEnabled) {
        if (
          volumeDelta != null &&
          amount != null &&
          volumeDelta.transactionAmount / amount.transactionAmount < 0.05
        ) {
          falsePositiveDetails = {
            isFalsePositive: true,
            confidenceScore: _.random(60, 80),
          }
        }
      }

      const hitResult: RuleHitResult = []
      if (isSenderHit) {
        hitResult.push({
          direction: 'ORIGIN',
          vars: {
            ...super.getTransactionVars('origin'),
            volumeDelta,
            volumeThreshold,
          },
          falsePositiveDetails: falsePositiveDetails,
        })
      }
      if (isReceiverHit) {
        hitResult.push({
          direction: 'DESTINATION',
          vars: {
            ...super.getTransactionVars('destination'),
            volumeDelta,
            volumeThreshold,
          },
          falsePositiveDetails: falsePositiveDetails,
        })
      }
      return hitResult
    }
  }
}
