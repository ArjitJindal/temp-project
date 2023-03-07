import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  AuxiliaryIndexTransaction,
  TransactionRepository,
} from '../repositories/transaction-repository'
import {
  TRANSACTIONS_THRESHOLD_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange, subtractTime } from '../utils/time-utils'
import { RuleHitResult } from '../rule'
import {
  groupTransactions,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TransactionAggregationRule } from './aggregation-rule'
import dayjs from '@/utils/dayjs'
import { MissingRuleParameter } from '@/services/rules-engine/transaction-rules/errors'
import { getReceiverKeyId } from '@/services/rules-engine/utils'
import { Transaction } from '@/@types/openapi-public/Transaction'

type AggregationData = { [receiverKeyId: string]: number }

export type HighTrafficBetweenSamePartiesParameters = {
  timeWindow: TimeWindow
  transactionsLimit: number
}

export default class HighTrafficBetweenSameParties extends TransactionAggregationRule<
  HighTrafficBetweenSamePartiesParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<HighTrafficBetweenSamePartiesParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['timeWindow', 'transactionsLimit'],
    }
  }

  public async computeRule() {
    const { transactionsLimit } = this.parameters
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction)
    if (!receiverKeyId) {
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
    let count = 0
    if (userAggregationData) {
      userAggregationData
      count =
        _.sumBy(userAggregationData, (data) => data[receiverKeyId] || 0) + 1
    } else {
      count = (await this.computeRuleExpensive()).count
    }

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

  private async computeRuleExpensive() {
    const { timeWindow } = this.parameters
    if (timeWindow === undefined) {
      throw new MissingRuleParameter()
    }
    const { originUserId, timestamp } = this.transaction

    if (timestamp == null) {
      throw new Error(`Transaction timestamp is missing`) // todo: better error
    }

    // todo: move to constructor
    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const transactions =
      await transactionRepository.getGenericUserSendingTransactions(
        originUserId,
        this.transaction.originPaymentDetails,
        {
          beforeTimestamp: timestamp,
          afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
        },
        {
          transactionStates: this.filters.transactionStatesHistorical,
          originPaymentMethod: this.filters.paymentMethodHistorical,
          transactionTypes: this.filters.transactionTypesHistorical,
          originCountries: this.filters.transactionCountriesHistorical,
        },
        ['timestamp', 'destinationUserId', 'destinationPaymentDetails']
      )

    // Update aggregations
    await this.refreshRuleAggregations(
      'origin',
      await this.getTimeAggregatedResult(transactions)
    )
    return {
      count:
        transactions.filter(
          (transaction) =>
            getReceiverKeyId(this.tenantId, transaction as Transaction) ===
            getReceiverKeyId(this.tenantId, this.transaction)
        ).length + 1,
    }
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
          async (group) => group.length
        )
      }
    )
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered) {
      return null
    }
    const receiverKeyId = getReceiverKeyId(this.tenantId, this.transaction)
    if (!receiverKeyId) {
      return targetAggregationData ?? {}
    }
    return {
      ...targetAggregationData,
      [receiverKeyId]: (targetAggregationData?.[receiverKeyId] ?? 0) + 1,
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  override getRuleAggregationVersion(): number {
    return 1
  }
}
