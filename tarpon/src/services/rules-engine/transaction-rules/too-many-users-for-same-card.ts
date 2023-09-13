import { JSONSchemaType } from 'ajv'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { getNonUserReceiverKeys, getNonUserSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionAggregationRule } from './aggregation-rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

type AggregationData = {
  userIds: string[]
}

export type TooManyUsersForSameCardParameters = {
  uniqueUsersCountThreshold: number
  timeWindowInDays: number
}

export default class TooManyUsersForSameCardRule extends TransactionAggregationRule<
  TooManyUsersForSameCardParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TooManyUsersForSameCardParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users count threshold',
          description:
            'rule is run when the users count per time window is greater than the threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time window (days)' },
      },
      required: ['uniqueUsersCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    if (
      this.transaction.originPaymentDetails?.method !== 'CARD' ||
      !this.transaction.originUserId
    ) {
      return
    }

    const { userIds } = await this.getData()
    userIds.add(this.transaction.originUserId)

    const hitResult: RuleHitResult = []
    if (userIds.size > this.parameters.uniqueUsersCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          cardFingerprint: (
            this.transaction.originPaymentDetails as CardDetails
          ).cardFingerprint,
          uniqueUserCount: userIds.size,
        },
      })
    }
    return hitResult
  }

  private async getRawTransactionsData(): Promise<AuxiliaryIndexTransaction[]> {
    const { sendingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        {
          ...this.transaction,
          originUserId: undefined, // to force search by payment details
          destinationUserId: undefined,
        },
        'origin',
        this.transactionRepository,
        {
          timeWindow: {
            units: this.parameters.timeWindowInDays,
            granularity: 'day',
            rollingBasis: true,
          },
          checkDirection: 'sending',
          filters: this.filters,
        },
        ['timestamp', 'originUserId']
      )

    return sendingTransactions
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): Promise<void> {
    if (direction !== 'origin' || !isTransactionFiltered) {
      return
    }

    const sendingTransactions = await this.getRawTransactionsData()

    sendingTransactions.push(this.transaction)

    await this.saveRebuiltRuleAggregations(
      direction,
      await this.getTimeAggregatedResult(sendingTransactions)
    )
  }

  private async getData(): Promise<{
    userIds: Set<string>
  }> {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      {
        units: this.parameters.timeWindowInDays,
        granularity: 'day',
        rollingBasis: true,
      }
    )
    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'origin',
      afterTimestamp,
      beforeTimestamp
    )
    if (userAggregationData) {
      return {
        userIds: new Set(userAggregationData.flatMap((v) => v.userIds)),
      }
    }

    // Fallback
    if (this.shouldUseRawData()) {
      const sendingTransactions = await this.getRawTransactionsData()
      const sendingTransactionsWithOriginUserId = sendingTransactions.filter(
        (transaction) => transaction.originUserId
      )

      // Update aggregations
      await this.saveRebuiltRuleAggregations(
        'origin',
        await this.getTimeAggregatedResult(sendingTransactionsWithOriginUserId)
      )

      return {
        userIds: this.getUniqueOriginUserIds(
          sendingTransactionsWithOriginUserId
        ),
      }
    } else {
      return {
        userIds: new Set(),
      }
    }
  }

  private getUniqueOriginUserIds(
    transactions: AuxiliaryIndexTransaction[]
  ): Set<string> {
    return new Set(
      transactions
        .map((transaction) => transaction.originUserId)
        .filter(Boolean)
    ) as Set<string>
  }

  private async getTimeAggregatedResult(
    sendingTransactionsWithOriginUserId: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
      sendingTransactionsWithOriginUserId,
      async (group) => ({
        userIds: Array.from(this.getUniqueOriginUserIds(group)),
      })
    )
  }

  override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (
      !isTransactionFiltered ||
      direction === 'destination' ||
      !this.transaction.originUserId ||
      this.transaction.originPaymentDetails?.method !== 'CARD'
    ) {
      return null
    }

    return {
      userIds: Array.from(
        new Set(
          (targetAggregationData?.userIds ?? []).concat(
            this.transaction.originUserId
          )
        )
      ),
    }
  }

  override getUserKeyId(direction: 'origin' | 'destination') {
    return direction === 'origin'
      ? getNonUserSenderKeys(this.tenantId, this.transaction, undefined, true)
          ?.PartitionKeyID
      : getNonUserReceiverKeys(this.tenantId, this.transaction, undefined, true)
          ?.PartitionKeyID
  }

  override getMaxTimeWindow(): TimeWindow {
    return {
      units: this.parameters.timeWindowInDays,
      granularity: 'day',
    }
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }
}
