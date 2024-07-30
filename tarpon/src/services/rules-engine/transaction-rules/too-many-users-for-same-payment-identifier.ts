import { JSONSchemaType } from 'ajv'
import { mergeWith, uniq, startCase } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { getNonUserReceiverKeys, getNonUserSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionAggregationRule } from './aggregation-rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { traceable } from '@/core/xray'

type AggregationData = {
  userIds: string[]
}

export type TooManyUsersForSamePaymentIdentifierParameters = {
  uniqueUsersCountThreshold: number
  timeWindow: TimeWindow
}

@traceable
export default class TooManyUsersForSamePaymentIdentifierRule extends TransactionAggregationRule<
  TooManyUsersForSamePaymentIdentifierParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<TooManyUsersForSamePaymentIdentifierParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users count threshold',
          description:
            'rule is run when the users count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['uniqueUsersCountThreshold', 'timeWindow'],
    }
  }
  public async computeRule() {
    if (
      !this.transaction.originUserId ||
      this.getUniqueIdentifier(this.transaction?.originPaymentDetails) ===
        undefined
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
          uniquePaymentIdentifier: this.getUniqueIdentifier(
            this.transaction.originPaymentDetails
          ),
          uniqueUserCount: userIds.size,
        },
      })
    }
    return hitResult
  }

  private getUniqueIdentifier(paymentDetails: PaymentDetails | undefined) {
    if (paymentDetails?.method === undefined) {
      return undefined
    }
    const identifiers = PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails?.method]
    return identifiers
      .map(
        (identifier: string) =>
          `${startCase(identifier)}: ${paymentDetails[identifier]}`
      )
      .join(', ')
  }

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
      {
        ...this.transaction,
        originUserId: undefined, // to force search by payment details
        destinationUserId: undefined,
      },
      'origin',
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkDirection: 'sending',
        filters: this.filters,
      },
      ['timestamp', 'originUserId']
    )

    for await (const data of generator) {
      yield data.sendingTransactions
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return Boolean(
      direction === 'origin' &&
        isTransactionHistoricalFiltered &&
        this.transaction.originUserId &&
        this.getUniqueIdentifier(this.transaction?.originPaymentDetails) !==
          undefined
    )
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
        (a: AggregationData | undefined, b: AggregationData | undefined) => {
          const result: AggregationData = {
            userIds: uniq([...(a?.userIds ?? []), ...(b?.userIds ?? [])]),
          }
          return result
        }
      )
    }
    await this.saveRebuiltRuleAggregations(direction, timeAggregatedResult)
  }

  private async getData(): Promise<{
    userIds: Set<string>
  }> {
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      this.parameters.timeWindow
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

    if (this.shouldUseRawData()) {
      const uniqueUserIds = new Set<string>()
      for await (const data of this.getRawTransactionsData()) {
        const sendingTransactionsWithOriginUserId = data.filter(
          (transaction) => transaction.originUserId
        )
        const partialUserIds = this.getUniqueOriginUserIds(
          sendingTransactionsWithOriginUserId
        )
        Array.from(partialUserIds).forEach((userId) =>
          uniqueUserIds.add(userId)
        )
      }
      return {
        userIds: uniqueUserIds,
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
    return groupTransactionsByTime<AggregationData>(
      sendingTransactionsWithOriginUserId,
      async (group) => ({
        userIds: Array.from(this.getUniqueOriginUserIds(group)),
      }),
      this.getAggregationGranularity()
    )
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return {
      userIds: Array.from(
        new Set(
          (targetAggregationData?.userIds ?? []).concat(
            this.transaction.originUserId ?? ''
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
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }
}
