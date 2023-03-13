import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository'
import {
  getTransactionsTotalAmount,
  groupTransactions,
  groupTransactionsByHour,
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
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

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
    let volumeDelta = null
    let volumeThreshold = null
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
      const countResult = await highTrafficCountRule.computeRule()
      countHit = Boolean(countResult && countResult.length > 0)
    }

    const hitResult: RuleHitResult = []
    const transactionAmountHit = await isTransactionAmountAboveThreshold(
      transactionAmounts,
      transactionVolumeThreshold
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
          confidenceScore: _.random(60, 80),
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
    return hitResult
  }

  private async getData(): Promise<TransactionAmountDetails> {
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    }) as string
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      const amount = await getTargetCurrencyAmount(
        this.transaction.originAmountDetails!,
        this.getTargetCurrency()
      )
      const amountValue =
        _.sumBy(userAggregationData, (data) => data[receiverKeyId] || 0) +
        amount.transactionAmount
      return {
        transactionAmount: amountValue,
        transactionCurrency: this.getTargetCurrency(),
      }
    }

    // Fallback
    const transactions =
      await this.transactionRepository.getGenericUserSendingTransactions(
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
          originPaymentMethod: this.filters.paymentMethodHistorical,
          transactionTypes: this.filters.transactionTypesHistorical,
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

    // Update aggregations
    await this.refreshRuleAggregations(
      'origin',
      await this.getTimeAggregatedResult(transactions)
    )

    return getTransactionsTotalAmount(
      transactions
        .filter(
          (transaction) =>
            getReceiverKeyId(this.tenantId, transaction as Transaction, {
              matchPaymentDetails:
                this.parameters.destinationMatchPaymentMethodDetails,
            }) === receiverKeyId
        )
        .concat(this.transaction)
        .map((transaction) => transaction.originAmountDetails),
      this.getTargetCurrency()
    )
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
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
                this.getTargetCurrency()
              )
            ).transactionAmount
        )
      }
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
      },
      {
        parameters: this
          .parameters as HighTrafficVolumeBetweenSameUsersParameters & {
          transactionsLimit: number
        },
        filters: this.filters,
      },
      { ruleInstance: { ...this.ruleInstance, id: `_${this.ruleInstance}` } },
      this.dynamoDb,
      this.transactionRepository
    )
  }

  private getTargetCurrency(): CurrencyCode {
    return Object.keys(
      this.parameters.transactionVolumeThreshold
    )[0] as CurrencyCode
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered || direction === 'destination') {
      return null
    }
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    })
    if (!receiverKeyId) {
      return targetAggregationData ?? {}
    }
    const amount = await getTargetCurrencyAmount(
      this.transaction.originAmountDetails!,
      this.getTargetCurrency()
    )
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
    return 1
  }
}
