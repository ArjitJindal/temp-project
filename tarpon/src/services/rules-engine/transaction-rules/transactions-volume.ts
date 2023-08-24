import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { chain, compact, flatMap, isEmpty, random, sumBy, uniq } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
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
  TransactionsCounterPartiesThreshold,
  TRANSACTION_COUNTERPARTIES_THRESHOLD_OPTIONAL_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResultItem } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { mergeObjects } from '@/utils/object'

type AggregationData = {
  sendingCount?: number
  sendingAmount?: number
  receivingCount?: number
  receivingAmount?: number
  senderKeys?: string[] // this is about number of unique receivers a sender has sent transactions to
  receiverKeys?: string[] // this is about number of unique senders a receiver has received transactions from
}

type AggregationResult = {
  totalAmount: TransactionAmountDetails
  totalCount: number
  transactionsCounterPartiesCount: number
}

export type TransactionsVolumeRuleParameters = {
  initialTransactions?: number
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  transactionVolumeUpperThreshold?: {
    [currency: string]: number
  }
  timeWindow: TimeWindow
  transactionsCounterPartiesThreshold?: TransactionsCounterPartiesThreshold
  checkSender: 'sending' | 'all' | 'none'
  checkReceiver: 'receiving' | 'all' | 'none'
  originMatchPaymentMethodDetails?: boolean
  destinationMatchPaymentMethodDetails?: boolean
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
          description:
            'Transactions volume below this amount rule will not be hit',
        }),
        transactionVolumeUpperThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA({
            title: 'Upper transactions volume threshold',
            description:
              'If set, transactions volume exceeds this amount rule will not be hit',
          }),
        timeWindow: TIME_WINDOW_SCHEMA(),
        transactionsCounterPartiesThreshold:
          TRANSACTION_COUNTERPARTIES_THRESHOLD_OPTIONAL_SCHEMA(),
        checkSender: CHECK_SENDER_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_SCHEMA(),
        originMatchPaymentMethodDetails:
          MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
            title: 'Match payment method details (origin)',
            description:
              'Sender is identified based on by payment details, not user ID',
          }),
        destinationMatchPaymentMethodDetails:
          MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
            title: 'Match payment method details (destination)',
            description:
              'Receiver is identified based on by payment details, not user ID',
          }),
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
      transactionsCounterPartiesThreshold,
      transactionVolumeUpperThreshold,
    } = this.parameters
    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    const aggregationData = await this.getData(direction)

    if (!aggregationData) {
      return
    }

    const { totalAmount, totalCount, transactionsCounterPartiesCount } =
      aggregationData

    if (initialTransactions && totalCount <= initialTransactions) {
      return
    }

    if (
      transactionsCounterPartiesThreshold?.transactionsCounterPartiesCount !=
        null &&
      transactionsCounterPartiesCount <
        transactionsCounterPartiesThreshold.transactionsCounterPartiesCount
    ) {
      return
    }

    const result = await isTransactionAmountAboveThreshold(
      totalAmount,
      transactionVolumeThreshold
    )
    if (!result.isHit) {
      return
    }

    if (!isEmpty(transactionVolumeUpperThreshold)) {
      const result = await isTransactionAmountAboveThreshold(
        totalAmount,
        transactionVolumeUpperThreshold
      )

      if (result.isHit) {
        return
      }
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
          confidenceScore: random(60, 80),
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

  private async getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): Promise<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const {
      checkSender,
      checkReceiver,
      timeWindow,
      originMatchPaymentMethodDetails,
      destinationMatchPaymentMethodDetails,
    } = this.parameters

    const { sendingTransactions, receivingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
        direction,
        this.transactionRepository,
        {
          timeWindow,
          checkDirection:
            (direction === 'origin' ? checkSender : checkReceiver) ?? 'all',
          matchPaymentMethodDetails:
            direction === 'origin'
              ? originMatchPaymentMethodDetails
              : destinationMatchPaymentMethodDetails,
          filters: this.filters,
        },
        [
          'timestamp',
          'originUserId',
          'destinationUserId',
          'originAmountDetails',
          'destinationAmountDetails',
          'originPaymentDetails',
          'destinationPaymentDetails',
        ]
      )

    return {
      sendingTransactions,
      receivingTransactions,
    }
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationResult> {
    const { checkSender, checkReceiver, timeWindow } = this.parameters

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

      const totalCount = sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingCount
            : checkDirection === 'receiving'
            ? data.receivingCount
            : (data.sendingCount ?? 0) + (data.receivingCount ?? 0)) ?? 0
      )

      const userKeys = uniq(
        flatMap(userAggregationData, (data) =>
          checkDirection === 'sending'
            ? data.receiverKeys ?? []
            : checkDirection === 'receiving'
            ? data.senderKeys ?? []
            : uniq(
                compact<string>([
                  ...(data.receiverKeys ?? []),
                  ...(data.senderKeys ?? []),
                ])
              )
        )
      )

      const totalAmount = sumBy(
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

      const currentUserId =
        direction === 'origin' ? this.getReceiverKeyId() : this.getSenderKeyId()

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
        transactionsCounterPartiesCount: uniq(
          compact<string>([...userKeys, currentUserId])
        ).length,
      }
    }

    // Fallback
    if (this.shouldUseRawData()) {
      // Update aggregations

      const { sendingTransactions, receivingTransactions } =
        await this.getRawTransactionsData(direction)

      const timeAggregatedResult = await this.getTimeAggregatedResult(
        sendingTransactions,
        receivingTransactions
      )

      await this.rebuildRuleAggregations(direction, timeAggregatedResult)

      return await this.computeRawData(
        direction,
        timeAggregatedResult,
        sendingTransactions,
        receivingTransactions
      )
    } else {
      return await this.computeRawData(direction, {})
    }
  }

  private async computeRawData(
    direction: 'origin' | 'destination',
    timeAggregatedResult: {
      [key: string]: AggregationData
    },
    sendingTransactions: AuxiliaryIndexTransaction[] = [],
    receivingTransactions: AuxiliaryIndexTransaction[] = []
  ): Promise<AggregationResult> {
    const { transactionVolumeThreshold } = this.parameters

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

    const transactionsCounterPartiesCount = chain(timeAggregatedResult)
      .flatMap(({ receiverKeys, senderKeys }) => [
        ...(receiverKeys ?? []),
        ...(senderKeys ?? []),
        direction === 'origin'
          ? this.getReceiverKeyId()
          : this.getSenderKeyId(),
      ])
      .compact()
      .uniq()
      .size()
      .value()

    const totalAmount = sumTransactionAmountDetails(
      sendingAmount,
      receivingAmount
    )

    return {
      totalAmount,
      totalCount: sendingTransactions.length + receivingTransactions.length,
      transactionsCounterPartiesCount,
    }
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): Promise<void> {
    const { sendingTransactions, receivingTransactions } =
      await this.getRawTransactionsData('origin')

    if (
      isTransactionHistoricalFiltered &&
      (this.transaction.originUserId || this.transaction.destinationUserId)
    ) {
      if (direction === 'origin') {
        sendingTransactions.push(this.transaction)
      } else {
        receivingTransactions.push(this.transaction)
      }
    }

    const timeAggregatedResult = await this.getTimeAggregatedResult(
      sendingTransactions,
      receivingTransactions
    )

    await this.rebuildRuleAggregations(direction, timeAggregatedResult)
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
    return mergeObjects(
      await groupTransactionsByHour<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
          sendingAmount: (
            await getTransactionsTotalAmount(
              group.map((t) => t.originAmountDetails),
              this.getTargetCurrency()
            )
          ).transactionAmount,
          ...(this.parameters.transactionsCounterPartiesThreshold
            ? {
                receiverKeys: uniq(
                  compact<string>(
                    group.map((t) => this.getReceiverKeyId(t as Transaction))
                  )
                ), // this is about the number of receivers a sender has sent transactions to
              }
            : {}),
        })
      ),
      await groupTransactionsByHour<AggregationData>(
        receivingTransactions,
        async (group) => ({
          receivingCount: group.length,
          receivingAmount: (
            await getTransactionsTotalAmount(
              group.map((t) => t.destinationAmountDetails),
              this.getTargetCurrency()
            )
          ).transactionAmount,
          ...(this.parameters.transactionsCounterPartiesThreshold
            ? {
                senderKeys: uniq(
                  compact<string>(
                    group.map((t) => this.getSenderKeyId(t as Transaction))
                  )
                ),
              }
            : {}), // this is about the number of senders a receiver has received transactions from
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
      result.receiverKeys = uniq(
        compact<string>([
          ...(result.receiverKeys ?? []),
          this.getReceiverKeyId(),
        ]) as string[]
      )
    } else {
      result.receivingCount = (result.receivingCount ?? 0) + 1
      result.receivingAmount =
        (result.receivingAmount ?? 0) + targetAmount.transactionAmount
      result.senderKeys = uniq(
        compact<string>([
          ...(result.senderKeys ?? []),
          this.getSenderKeyId(),
        ]) as string[]
      )
    }
    return result
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  override getRuleAggregationVersion(): number {
    return 2
  }

  override getUserKeyId(direction: 'origin' | 'destination') {
    return direction === 'origin'
      ? getSenderKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
          matchPaymentDetails: this.parameters.originMatchPaymentMethodDetails,
        })
      : getReceiverKeyId(this.tenantId, this.transaction, {
          disableDirection: true,
          matchPaymentDetails:
            this.parameters.destinationMatchPaymentMethodDetails,
        })
  }

  private getSenderKeyId(transaction?: Transaction) {
    return getSenderKeyId(this.tenantId, transaction ?? this.transaction, {
      disableDirection: true,
      matchPaymentDetails:
        this.parameters.transactionsCounterPartiesThreshold
          ?.checkPaymentMethodDetails ?? false,
    })
  }

  private getReceiverKeyId(transaction?: Transaction) {
    return getReceiverKeyId(this.tenantId, transaction ?? this.transaction, {
      disableDirection: true,
      matchPaymentDetails:
        this.parameters.transactionsCounterPartiesThreshold
          ?.checkPaymentMethodDetails ?? false,
    })
  }
}
