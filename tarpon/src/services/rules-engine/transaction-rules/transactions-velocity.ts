import { JSONSchemaType } from 'ajv'

import sumBy from 'lodash/sumBy'
import mergeWith from 'lodash/mergeWith'
import { TransactionHistoricalFilters } from '../filters'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import {
  CHECK_RECEIVER_OPTIONAL_SCHEMA,
  CHECK_SENDER_OPTIONAL_SCHEMA,
  TimeWindow,
  TIME_WINDOW_SCHEMA,
  TRANSACTIONS_THRESHOLD_SCHEMA,
  MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResultItem } from '../rule'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { getTimestampRange } from '../utils/time-utils'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'

type AggregationData = {
  sendingCount?: number
  receivingCount?: number
}

export type TransactionsVelocityRuleParameters = {
  transactionsLimit: number
  timeWindow: TimeWindow

  checkSender?: 'sending' | 'all' | 'none'
  checkReceiver?: 'receiving' | 'all' | 'none'

  // Optional parameters
  onlyCheckKnownUsers?: boolean
  originMatchPaymentMethodDetails?: boolean
  destinationMatchPaymentMethodDetails?: boolean
}

@traceable
export default class TransactionsVelocityRule extends TransactionAggregationRule<
  TransactionsVelocityRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TransactionsVelocityRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionsLimit: TRANSACTIONS_THRESHOLD_SCHEMA(),
        timeWindow: TIME_WINDOW_SCHEMA(),
        checkSender: CHECK_SENDER_OPTIONAL_SCHEMA(),
        checkReceiver: CHECK_RECEIVER_OPTIONAL_SCHEMA(),
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
        onlyCheckKnownUsers: {
          type: 'boolean',
          title: 'Only check transactions from known users (with user ID)',
          nullable: true,
        },
      },
      required: ['transactionsLimit', 'timeWindow'],
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
      transactionsLimit,
      onlyCheckKnownUsers,
      checkSender,
      checkReceiver,
    } = this.parameters

    if (direction === 'origin' && checkSender === 'none') {
      return
    } else if (direction === 'destination' && checkReceiver === 'none') {
      return
    }

    if (
      onlyCheckKnownUsers &&
      (!this.transaction.originUserId || !this.transaction.destinationUserId)
    ) {
      return
    }

    const transactionsCount = await this.getData(direction)
    if (!transactionsCount) {
      return
    }
    if (transactionsCount + 1 > transactionsLimit) {
      const transactionsDif = transactionsCount - transactionsLimit + 1
      return {
        direction: direction === 'origin' ? 'ORIGIN' : 'DESTINATION',
        vars: {
          ...super.getTransactionVars(direction),
          transactionsDif,
        },
      }
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

  private async getData(direction: 'origin' | 'destination'): Promise<number> {
    const { timeWindow, checkSender, checkReceiver } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )
    const checkDirection = direction === 'origin' ? checkSender : checkReceiver
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      direction,
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      const transactionsCount = sumBy(
        userAggregationData,
        (data) =>
          (checkDirection === 'sending'
            ? data.sendingCount
            : checkDirection === 'receiving'
            ? data.receivingCount
            : (data.sendingCount ?? 0) + (data.receivingCount ?? 0)) ?? 0
      )
      return transactionsCount
    }

    if (this.shouldUseRawData()) {
      let transactionsCount = 0
      for await (const data of this.getRawTransactionsData(direction)) {
        transactionsCount +=
          data.sendingTransactions.length + data.receivingTransactions.length
      }

      return transactionsCount
    } else {
      return 0
    }
  }

  private async *getRawTransactionsData(
    direction: 'origin' | 'destination'
  ): AsyncGenerator<{
    sendingTransactions: AuxiliaryIndexTransaction[]
    receivingTransactions: AuxiliaryIndexTransaction[]
  }> {
    const {
      timeWindow,
      checkSender,
      checkReceiver,
      onlyCheckKnownUsers,
      originMatchPaymentMethodDetails,
      destinationMatchPaymentMethodDetails,
    } = this.parameters

    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
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
      ['timestamp', 'originUserId', 'destinationUserId']
    )
    for await (const data of generator) {
      const filteredSendingTransactions = data.sendingTransactions.filter(
        (transaction) => !onlyCheckKnownUsers || transaction.originUserId
      )
      const filteredReceivingTransactions = data.receivingTransactions.filter(
        (transaction) => !onlyCheckKnownUsers || transaction.destinationUserId
      )

      yield {
        sendingTransactions: filteredSendingTransactions,
        receivingTransactions: filteredReceivingTransactions,
      }
    }
  }

  private async getTimeAggregatedResult(
    sendingTransactions: AuxiliaryIndexTransaction[],
    receivingTransactions: AuxiliaryIndexTransaction[]
  ) {
    return mergeObjects(
      await groupTransactionsByTime<AggregationData>(
        sendingTransactions,
        async (group) => ({
          sendingCount: group.length,
        }),
        this.getAggregationGranularity()
      ),
      await groupTransactionsByTime<AggregationData>(
        receivingTransactions,
        async (group) => ({
          receivingCount: group.length,
        }),
        this.getAggregationGranularity()
      )
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    if (
      this.parameters.onlyCheckKnownUsers &&
      (!this.transaction.originUserId || !this.transaction.destinationUserId)
    ) {
      return null
    }
    const result = targetAggregationData ?? {}
    if (direction === 'origin') {
      result.sendingCount = (result.sendingCount ?? 0) + 1
    } else {
      result.receivingCount = (result.receivingCount ?? 0) + 1
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
}
