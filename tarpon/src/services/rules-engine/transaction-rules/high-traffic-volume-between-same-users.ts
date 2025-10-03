import { JSONSchemaType } from 'ajv'
import mergeWith from 'lodash/mergeWith'
import random from 'lodash/random'
import sumBy from 'lodash/sumBy'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  getTransactionsTotalAmount,
  groupTransactions,
  groupTransactionsByTime,
  isTransactionAmountAboveThreshold,
} from '../utils/transaction-rule-utils'
import { getTimestampRange, subtractTime } from '../utils/time-utils'
import {
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA,
  TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA,
  MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'

import { TransactionAggregationRule } from './aggregation-rule'
import dayjs from '@/utils/dayjs'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'
import { CurrencyService } from '@/services/currency'

type AggregationData = { [receiverKeyId: string]: number }

export type HighTrafficVolumeBetweenSameUsersParameters = {
  timeWindow: TimeWindow
  transactionVolumeThreshold: {
    [currency: string]: number
  }
  transactionsLimit?: number
  originMatchPaymentMethodDetails?: boolean
  destinationMatchPaymentMethodDetails?: boolean
}

@traceable
export default class HighTrafficVolumeBetweenSameUsers extends TransactionAggregationRule<
  HighTrafficVolumeBetweenSameUsersParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<HighTrafficVolumeBetweenSameUsersParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions volume threshold',
        }),
        transactionsLimit: TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        originMatchPaymentMethodDetails:
          MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
            title: 'Match payment method details (origin)',
            description:
              'Only the transactions with the origin payment details as the origin payment details will be checked',
          }),
        destinationMatchPaymentMethodDetails:
          MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA({
            title: 'Match payment method details (destination)',
            description:
              'Only the transactions with the destination payment details as the destination payment details will be checked',
          }),
      },
      required: ['timeWindow', 'transactionVolumeThreshold'],
    }
  }

  public async computeRule() {
    const { transactionVolumeThreshold, transactionsLimit } = this.parameters
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    })
    if (!this.transaction.originAmountDetails || !receiverKeyId) {
      return
    }

    const transactionAmounts = await this.getData()
    const targetCurrency = this.getTargetCurrency()
    let volumeDelta: any = null
    let volumeThreshold: any = null
    if (
      transactionAmounts != null &&
      transactionVolumeThreshold[targetCurrency] != null
    ) {
      volumeDelta = {
        transactionAmount:
          transactionAmounts.transactionAmount -
          transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
      volumeThreshold = {
        transactionAmount: transactionVolumeThreshold[targetCurrency],
        transactionCurrency: targetCurrency,
      }
    }

    let countHit = true
    if (Number.isFinite(transactionsLimit)) {
      const highTrafficCountRule = this.getDependencyRule()
      const countResult = (await highTrafficCountRule.computeRule())
        ?.ruleHitResult
      countHit = Boolean(countResult && countResult.length > 0)
    }

    const hitResult: RuleHitResult = []
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      transactionAmounts,
      transactionVolumeThreshold,
      this.dynamoDb
    )
    let falsePositiveDetails
    if (this.ruleInstance.falsePositiveCheckEnabled) {
      if (
        volumeDelta != null &&
        transactionAmounts != null &&
        volumeDelta.transactionAmount / transactionAmounts.transactionAmount <
          0.05
      ) {
        falsePositiveDetails = {
          isFalsePositive: true,
          confidenceScore: random(60, 80),
        }
      }
    }

    if (transactionAmountHit.isHit && countHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          volumeDelta,
          volumeThreshold,
        },
        falsePositiveDetails,
      })
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
    return {
      ruleHitResult: hitResult,
    }
  }

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    yield* await this.transactionRepository.getGenericUserSendingTransactionsGenerator(
      this.transaction.originUserId,
      this.transaction.originPaymentDetails,
      {
        beforeTimestamp: this.transaction.timestamp,
        afterTimestamp: subtractTime(
          dayjs(this.transaction.timestamp),
          this.parameters.timeWindow
        ),
      },
      {
        transactionStates: this.filters.transactionStatesHistorical,
        originPaymentMethods: this.filters.paymentMethodsHistorical,
        transactionTypes: this.filters.transactionTypesHistorical,
        transactionAmountRange: this.filters.transactionAmountRangeHistorical,
        originCountries: this.filters.transactionCountriesHistorical,
      },
      [
        'timestamp',
        'originAmountDetails',
        'destinationUserId',
        'destinationPaymentDetails',
      ],
      this.parameters.originMatchPaymentMethodDetails
    )
  }

  private async getData(): Promise<TransactionAmountDetails> {
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    }) as string
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp ?? 0,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    const currencyService = new CurrencyService(this.dynamoDb)
    if (userAggregationData) {
      const amount = this.transaction.originAmountDetails
        ? await currencyService.getTargetCurrencyAmount(
            this.transaction.originAmountDetails,
            this.getTargetCurrency()
          )
        : {
            transactionAmount: 0,
            transactionCurrency: this.getTargetCurrency(),
          }
      const amountValue =
        sumBy(userAggregationData, (data) => data[receiverKeyId] || 0) +
        amount.transactionAmount
      return {
        transactionAmount: amountValue,
        transactionCurrency: this.getTargetCurrency(),
      }
    }

    let totalAmount: TransactionAmountDetails =
      await getTransactionsTotalAmount(
        [this.transaction.originAmountDetails],
        this.getTargetCurrency(),
        this.dynamoDb
      )

    if (this.shouldUseRawData()) {
      for await (const data of this.getRawTransactionsData()) {
        const receiverKeyId = getReceiverKeyId(
          this.tenantId,
          this.transaction,
          {
            matchPaymentDetails:
              this.parameters.destinationMatchPaymentMethodDetails,
          }
        ) as string

        totalAmount = await getTransactionsTotalAmount(
          data
            .filter(
              (transaction) =>
                getReceiverKeyId(this.tenantId, transaction as Transaction, {
                  matchPaymentDetails:
                    this.parameters.destinationMatchPaymentMethodDetails,
                }) === receiverKeyId
            )
            .map((transaction) => transaction.originAmountDetails)
            .concat(totalAmount),
          this.getTargetCurrency(),
          this.dynamoDb
        )
      }
    }
    return totalAmount
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): boolean {
    return isTransactionFiltered && direction === 'origin'
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination'
  ): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getRawTransactionsData()) {
      const partialTimeAggregatedResult = await this.getTimeAggregatedResult(
        data
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData, b: AggregationData) => {
          return mergeWith(
            a,
            b,
            (x: number | undefined, y: number | undefined) =>
              (x ?? 0) + (y ?? 0)
          )
        }
      )
    }
    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)

    if (Number.isFinite(this.parameters.transactionsLimit)) {
      await this.getDependencyRule().rebuildUserAggregation(direction)
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByTime<AggregationData>(
      sendingTransactions,
      async (group) => {
        return groupTransactions(
          group,
          (transaction) =>
            getReceiverKeyId(this.tenantId, transaction as Transaction, {
              matchPaymentDetails:
                this.parameters.destinationMatchPaymentMethodDetails,
            }) || 'Unknown',
          async (group) =>
            (
              await getTransactionsTotalAmount(
                group.map((t) => t.originAmountDetails),
                this.getTargetCurrency(),
                this.dynamoDb
              )
            ).transactionAmount
        )
      },
      this.getAggregationGranularity()
    )
  }

  public async updateAggregation(
    direction: 'origin' | 'destination',
    filtered: boolean
  ) {
    await super.updateAggregation(direction, filtered)
    if (Number.isFinite(this.parameters.transactionsLimit)) {
      await this.getDependencyRule().updateAggregation(direction, filtered)
    }
  }

  private getDependencyRule(): HighTrafficBetweenSameParties {
    return new HighTrafficBetweenSameParties(
      this.tenantId,
      {
        transaction: this.transaction,
        senderUser: this.senderUser,
        receiverUser: this.receiverUser,
        stage: this.stage,
      },
      {
        parameters: this
          .parameters as HighTrafficVolumeBetweenSameUsersParameters & {
          transactionsLimit: number
        },
        filters: this.filters,
      },
      {
        ruleInstance: { ...this.ruleInstance, id: `_${this.ruleInstance}` },
        rule: this.rule,
      },
      {
        sanctionsService: this.sanctionsService,
        geoIpService: this.geoIpService,
      },
      this.mode,
      this.dynamoDb,
      this.mongoDb
    )
  }

  private getTargetCurrency(): CurrencyCode {
    return Object.keys(
      this.parameters.transactionVolumeThreshold
    )[0] as CurrencyCode
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    })
    const currencyService = new CurrencyService(this.dynamoDb)
    if (!receiverKeyId) {
      return targetAggregationData ?? {}
    }
    const amount = this.transaction.originAmountDetails
      ? await currencyService.getTargetCurrencyAmount(
          this.transaction.originAmountDetails,
          this.getTargetCurrency()
        )
      : {
          transactionAmount: 0,
          transactionCurrency: this.getTargetCurrency(),
        }
    return {
      ...targetAggregationData,
      [receiverKeyId]:
        (targetAggregationData?.[receiverKeyId] ?? 0) +
        amount.transactionAmount,
    }
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

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 2
  }
}
