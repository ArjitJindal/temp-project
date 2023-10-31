import { JSONSchemaType } from 'ajv'
import { startCase } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { getNonUserReceiverKeys, getNonUserSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { TransactionHistoricalFilters } from '../filters'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionAggregationRule } from './aggregation-rule'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'

type AggregationData = {
  userIds: string[]
}

export type TooManyUsersForSamePaymentIdentifierParameters = {
  uniqueUsersCountThreshold: number
  timeWindow: TimeWindow
}

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
    if (paymentDetails?.method === undefined) return undefined
    const identifiers = PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails?.method]
    return identifiers
      .map(
        (identifier: string) =>
          `${startCase(identifier)}: ${paymentDetails[identifier]}`
      )
      .join(', ')
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
          timeWindow: this.parameters.timeWindow,
          checkDirection: 'sending',
          filters: this.filters,
        },
        ['timestamp', 'originUserId']
      )

    return sendingTransactions
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
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return {
      userIds: Array.from(
        new Set(
          (targetAggregationData?.userIds ?? []).concat(
            this.transaction.originUserId!
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
