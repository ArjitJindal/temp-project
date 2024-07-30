import { JSONSchemaType } from 'ajv'

import { mergeWith, sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange, subtractTime } from '../utils/time-utils'
import { RuleHitResult } from '../rule'
import {
  groupTransactions,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import dayjs from '@/utils/dayjs'
import { getReceiverKeyId, getSenderKeyId } from '@/services/rules-engine/utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { traceable } from '@/core/xray'

type AggregationData = { [receiverKeyId: string]: number }

export type HighTrafficBetweenSamePartiesParameters = {
  timeWindow: TimeWindow
  transactionsLimit: number
  originMatchPaymentMethodDetails?: boolean
  destinationMatchPaymentMethodDetails?: boolean
}

@traceable
export default class HighTrafficBetweenSameParties extends TransactionAggregationRule<
  HighTrafficBetweenSamePartiesParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<HighTrafficBetweenSamePartiesParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
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
      required: ['timeWindow', 'transactionsLimit'],
    }
  }

  public async computeRule() {
    const { transactionsLimit } = this.parameters
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    })
    if (!receiverKeyId) {
      return
    }
    const count = await this.getData()

    const hitResult: RuleHitResult = []
    if (count > transactionsLimit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          count,
          delta: count - this.parameters.transactionsLimit,
        },
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...super.getTransactionVars('destination'),
          count,
          delta: count - this.parameters.transactionsLimit,
        },
      })
    }
    return hitResult
  }

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const { originUserId, timestamp } = this.transaction
    const { timeWindow } = this.parameters

    yield* await this.transactionRepository.getGenericUserSendingTransactionsGenerator(
      originUserId,
      this.transaction.originPaymentDetails,
      {
        beforeTimestamp: timestamp,
        afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
      },
      {
        transactionStates: this.filters.transactionStatesHistorical,
        originPaymentMethods: this.filters.paymentMethodsHistorical,
        transactionTypes: this.filters.transactionTypesHistorical,
        transactionAmountRange: this.filters.transactionAmountRangeHistorical,
        originCountries: this.filters.transactionCountriesHistorical,
      },
      ['timestamp', 'destinationUserId', 'destinationPaymentDetails'],
      this.parameters.originMatchPaymentMethodDetails
    )
  }

  private async getData(): Promise<number> {
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

    if (userAggregationData) {
      return sumBy(userAggregationData, (data) => data[receiverKeyId] || 0) + 1
    }

    if (this.shouldUseRawData()) {
      let transactionsCount = 1
      for await (const data of this.getRawTransactionsData()) {
        transactionsCount += data.filter(
          (transaction) =>
            getReceiverKeyId(this.tenantId, transaction as Transaction, {
              matchPaymentDetails:
                this.parameters.destinationMatchPaymentMethodDetails,
            }) === receiverKeyId
        ).length
      }
      return transactionsCount
    } else {
      return 1
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered && direction === 'origin'
  }

  public async rebuildUserAggregation(direction: 'origin' | 'destination') {
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
          async (group) => group.length
        )
      },
      this.getAggregationGranularity()
    )
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction, {
      matchPaymentDetails: this.parameters.destinationMatchPaymentMethodDetails,
    })
    if (!receiverKeyId) {
      return targetAggregationData ?? {}
    }
    return {
      ...targetAggregationData,
      [receiverKeyId]: (targetAggregationData?.[receiverKeyId] ?? 0) + 1,
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
