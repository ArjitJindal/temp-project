import { JSONSchemaType } from 'ajv'
import * as _ from 'lodash'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
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
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { getReceiverKeyId } from '../utils'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'

import { TransactionAggregationRule } from './aggregation-rule'
import dayjs from '@/utils/dayjs'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
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
}

export default class HighTrafficVolumeBetweenSameUsers extends TransactionAggregationRule<
  HighTrafficVolumeBetweenSameUsersParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficVolumeBetweenSameUsersParameters> {
    return {
      type: 'object',
      properties: {
        transactionVolumeThreshold: TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA({
          title: 'Transactions Volume Threshold',
        }),
        transactionsLimit: TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['timeWindow', 'transactionVolumeThreshold'],
    }
  }

  public async computeRule() {
    const { transactionVolumeThreshold, transactionsLimit } = this.parameters
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction)
    if (!this.transaction.originAmountDetails || !receiverKeyId) {
      return
    }

    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      this.parameters.timeWindow
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    let transactionAmounts: TransactionAmountDetails
    if (userAggregationData) {
      const amount = await getTargetCurrencyAmount(
        this.transaction.originAmountDetails!,
        this.getTargetCurrency()
      )
      const amountValue =
        _.sumBy(userAggregationData, (data) => data[receiverKeyId] || 0) +
        amount.transactionAmount
      transactionAmounts = {
        transactionAmount: amountValue,
        transactionCurrency: this.getTargetCurrency(),
      }
    } else {
      transactionAmounts = await this.computeRuleExpensive()
    }

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
    if (
      this.ruleInstance.falsePositiveCheckEnabled &&
      this.ruleInstance.caseCreationType === 'TRANSACTION'
    ) {
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

  private async computeRuleExpensive(): Promise<TransactionAmountDetails> {
    const { timeWindow } = this.parameters
    if (timeWindow === undefined) {
      throw new MissingRuleParameter()
    }
    const { transaction } = this
    const { originUserId, timestamp } = transaction

    if (timestamp == null) {
      throw new Error(`Transaction timestamp is missing`)
    }
    if (originUserId == null) {
      throw new Error(`Origin user ID is missing`)
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const transactions = await transactionRepository.getUserSendingTransactions(
      originUserId,
      {
        beforeTimestamp: timestamp,
        afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
      },
      {
        transactionStates: this.filters.transactionStatesHistorical,
        transactionTypes: this.filters.transactionTypesHistorical,
        originPaymentMethod: this.filters.paymentMethodHistorical,
        originCountries: this.filters.transactionCountriesHistorical,
      },
      [
        'timestamp',
        'originAmountDetails',
        'destinationUserId',
        'destinationPaymentDetails',
      ]
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
            getReceiverKeyId(this.tenantId, transaction as Transaction) ===
            getReceiverKeyId(this.tenantId, this.transaction)
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
            getReceiverKeyId(this.tenantId, transaction as Transaction) ||
            'Unknown',
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
      this.dynamoDb
    )
  }

  private getTargetCurrency(): CurrencyCode {
    return Object.keys(
      this.parameters.transactionVolumeThreshold
    )[0] as CurrencyCode
  }

  protected async getUpdatedTargetAggregation(
    _direction: 'origin',
    targetAggregationData: AggregationData | undefined,
    filtered: boolean
  ): Promise<AggregationData | null> {
    if (!filtered) {
      return null
    }
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction)
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

  protected getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  protected getRuleAggregationVersion(): number {
    return 1
  }
}
