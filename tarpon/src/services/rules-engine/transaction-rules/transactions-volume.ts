import { JSONSchemaType } from 'ajv'
import {
  compact,
  flatMap,
  isEmpty,
  mergeWith,
  random,
  sumBy,
  uniq,
} from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionsTotalAmount,
  getTransactionUserPastTransactionsByDirectionGenerator,
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
import { Transaction } from '@/@types/openapi-public/Transaction'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { CurrencyService } from '@/services/currency'

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
  transactionsCounterParties: string[]
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

@traceable
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

    const { totalAmount, totalCount, transactionsCounterParties } =
      aggregationData

    if (initialTransactions && totalCount <= initialTransactions) {
      return
    }

    if (
      transactionsCounterPartiesThreshold?.transactionsCounterPartiesCount !=
        null &&
      transactionsCounterParties.length <
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

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
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

    yield* getTransactionUserPastTransactionsByDirectionGenerator(
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
        'transactionId',
        'originUserId',
        'destinationUserId',
        'originAmountDetails',
        'destinationAmountDetails',
        'originPaymentDetails',
        'destinationPaymentDetails',
      ]
    )
  }

  private async getData(
    direction: 'origin' | 'destination'
  ): Promise<AggregationResult> {
    const { checkSender, checkReceiver, timeWindow } = this.parameters

    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
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

      const currencyService = new CurrencyService()

      const currentAmount =
        currentAmountDetails &&
        (await currencyService.getTargetCurrencyAmount(
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
        transactionsCounterParties: uniq(
          compact<string>([...userKeys, currentUserId])
        ),
      }
    }

    let aggregationResult = await this.getAggregationResult(
      direction === 'origin' ? [this.transaction] : [],
      direction === 'origin' ? [] : [this.transaction]
    )
    if (this.shouldUseRawData()) {
      for await (const data of this.getRawTransactionsData(direction)) {
        const partialAggregationResult = await this.getAggregationResult(
          data.sendingTransactions,
          data.receivingTransactions
        )
        aggregationResult = {
          totalAmount: {
            transactionAmount:
              (aggregationResult.totalAmount?.transactionAmount ?? 0) +
              (partialAggregationResult.totalAmount?.transactionAmount ?? 0),
            transactionCurrency: this.getTargetCurrency(),
          },
          totalCount:
            (aggregationResult.totalCount ?? 0) +
            (partialAggregationResult.totalCount ?? 0),
          transactionsCounterParties: uniq([
            ...(aggregationResult.transactionsCounterParties ?? []),
            ...(partialAggregationResult.transactionsCounterParties ?? []),
          ]),
        }
      }
      return aggregationResult
    } else {
      return aggregationResult
    }
  }

  private async getAggregationResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ): Promise<AggregationResult> {
    const sendingAmount = await getTransactionsTotalAmount(
      sendingTransactions.map((transaction) => transaction.originAmountDetails),
      this.getTargetCurrency()
    )
    const receivingAmount = await getTransactionsTotalAmount(
      receivingTransactions.map(
        (transaction) => transaction.destinationAmountDetails
      ),
      this.getTargetCurrency()
    )
    const totalAmount = sumTransactionAmountDetails(
      sendingAmount,
      receivingAmount
    )

    return {
      totalAmount,
      totalCount: sendingTransactions.length + receivingTransactions.length,
      transactionsCounterParties: uniq(
        compact([
          ...sendingTransactions.map((t) =>
            this.getReceiverKeyId(t as Transaction)
          ),
          ...receivingTransactions.map((t) =>
            this.getSenderKeyId(t as Transaction)
          ),
        ])
      ),
    }
  }

  public shouldUpdateUserAggregation(
    _direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData(direction)) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data.sendingTransactions,
        data.receivingTransactions
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData | undefined, b: AggregationData | undefined) => {
          const result: AggregationData = {
            sendingCount: (a?.sendingCount ?? 0) + (b?.sendingCount ?? 0),
            sendingAmount: (a?.sendingAmount ?? 0) + (b?.sendingAmount ?? 0),
            receivingCount: (a?.receivingCount ?? 0) + (b?.receivingCount ?? 0),
            receivingAmount:
              (a?.receivingAmount ?? 0) + (b?.receivingAmount ?? 0),
            senderKeys: uniq([
              ...(a?.senderKeys ?? []),
              ...(b?.senderKeys ?? []),
            ]),
            receiverKeys: uniq([
              ...(a?.receiverKeys ?? []),
              ...(b?.receiverKeys ?? []),
            ]),
          }
          return result
        }
      )
    }
    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
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
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const targetAmountDetails =
      direction === 'origin'
        ? this.transaction.originAmountDetails
        : this.transaction.destinationAmountDetails
    if (!targetAmountDetails) {
      return null
    }

    const currencyService = new CurrencyService()

    const targetAmount = await currencyService.getTargetCurrencyAmount(
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
