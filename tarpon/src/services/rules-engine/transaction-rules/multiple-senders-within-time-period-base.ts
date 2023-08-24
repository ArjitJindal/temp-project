import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TimeWindow, TIME_WINDOW_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { getNonUserSenderKeys } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { getTimestampRange } from '@/services/rules-engine/utils/time-utils'

export type MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: number
  timeWindow: TimeWindow
}

export type SenderReceiverTypes = {
  senderTypes: Array<'USER' | 'NON_USER'>
  receiverTypes: Array<'USER' | 'NON_USER'>
}

type AggregationData = {
  senderKeys?: string[]
}

export default abstract class MultipleSendersWithinTimePeriodRuleBase extends TransactionAggregationRule<
  MultipleSendersWithinTimePeriodRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<MultipleSendersWithinTimePeriodRuleParameters> {
    return {
      type: 'object',
      properties: {
        sendersCount: {
          type: 'integer',
          title: 'Senders count threshold',
          description:
            'rule is run when the senders count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['sendersCount', 'timeWindow'],
    }
  }

  protected abstract getSenderReceiverTypes(): SenderReceiverTypes

  public async computeRule() {
    const { sendersCount } = this.parameters
    const data = await this.getData()

    const hitResult: RuleHitResult = []

    const transactionUser = await this.getTransactionSenderUserKey()

    if (!transactionUser) {
      return hitResult
    }

    const updatedUsers = new Set([transactionUser, ...data])

    if (updatedUsers.size > sendersCount) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: super.getTransactionVars('destination'),
      })
    }
    return hitResult
  }

  private getTransactionSenderUserKey(): string | undefined {
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()

    let key = undefined

    if (
      (receiverTypes.includes('USER') && this.transaction.destinationUserId) ||
      (receiverTypes.includes('NON_USER') &&
        this.transaction.destinationPaymentDetails)
    ) {
      if (senderTypes.includes('USER') && this.senderUser) {
        key = this.senderUser.userId
      } else if (senderTypes.includes('NON_USER') && !this.senderUser) {
        key = getNonUserSenderKeys(
          this.tenantId,
          this.transaction
        )?.PartitionKeyID
      }
    }

    return key
  }

  private async getTransactionsRawData(): Promise<AuxiliaryIndexTransaction[]> {
    const { timeWindow } = this.parameters
    let senderTransactions: AuxiliaryIndexTransaction[] = []

    if (this.shouldFetchRawData()) {
      const { receivingTransactions } =
        await getTransactionUserPastTransactionsByDirection(
          this.transaction,
          'destination',
          this.transactionRepository,
          {
            timeWindow,
            checkDirection: 'receiving',
            matchPaymentMethodDetails: this.transaction.destinationUserId
              ? false
              : true,
            filters: this.filters,
          },
          ['senderKeyId', 'originUserId']
        )

      senderTransactions = receivingTransactions
    }

    return senderTransactions
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): Promise<void> {
    const senderTransactions = await this.getTransactionsRawData()

    if (direction === 'destination' && isTransactionFiltered) {
      senderTransactions.push({
        ...this.transaction,
        senderKeyId: this.getTransactionSenderUserKey(),
      })
    }

    const timeAggregatedResult = await this.getTimeAggregatedResult(
      senderTransactions
    )

    await this.rebuildRuleAggregations('destination', timeAggregatedResult)
  }

  private isCounterParty(): boolean {
    const { receiverTypes } = this.getSenderReceiverTypes()

    return Boolean(
      receiverTypes.includes('NON_USER') &&
        this.transaction.destinationPaymentDetails
    )
  }

  private isUser(): boolean {
    const { receiverTypes } = this.getSenderReceiverTypes()

    return Boolean(
      receiverTypes.includes('USER') && this.transaction.destinationUserId
    )
  }

  private shouldFetchRawData(): boolean {
    return this.isCounterParty() || this.isUser()
  }

  private async getData(): Promise<string[]> {
    const { timeWindow } = this.parameters
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp,
      timeWindow
    )

    const userAggregationData = await this.getRuleAggregations<AggregationData>(
      'destination',
      afterTimestamp,
      beforeTimestamp
    )

    if (userAggregationData) {
      return _.chain(userAggregationData)
        .flatMap((aggregationData) => aggregationData.senderKeys ?? [])
        .compact()
        .uniq()
        .value()
    }

    // Fallback
    if (this.shouldUseRawData()) {
      const senderTransactions = await this.getTransactionsRawData()

      const timeAggregatedResult = await this.getTimeAggregatedResult(
        senderTransactions
      )

      await this.rebuildRuleAggregations('destination', timeAggregatedResult)

      return this.getUniqueSendersKeys(senderTransactions)
    } else {
      const sendingUserKey = await this.getTransactionSenderUserKey()

      if (!sendingUserKey) {
        return []
      }

      return [sendingUserKey]
    }
  }

  private async getTimeAggregatedResult(
    senderTransactions: AuxiliaryIndexTransaction[]
  ) {
    return await groupTransactionsByHour<AggregationData>(
      senderTransactions,
      async (group) => {
        const uniqueSenders = this.getUniqueSendersKeys(group)
        return {
          senderKeys: uniqueSenders,
        }
      }
    )
  }

  private getUniqueSendersKeys(
    transactions: AuxiliaryIndexTransaction[]
  ): string[] {
    const { senderTypes } = this.getSenderReceiverTypes()

    const uniqueSenders = new Set(
      transactions
        .filter(
          (transaction) =>
            (senderTypes.includes('USER') && transaction.originUserId) ||
            senderTypes.includes('NON_USER')
        )
        .map((transaction) => transaction.senderKeyId)
    )

    return _.compact([...uniqueSenders])
  }

  protected override async getUpdatedTargetAggregation(
    direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    if (!isTransactionFiltered || direction === 'origin') {
      return null
    }

    const senderUsers = aggregation?.senderKeys ?? []

    const key = await this.getTransactionSenderUserKey()
    if (key) {
      senderUsers.push(key)
    }

    return {
      senderKeys: _.uniq(senderUsers),
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  protected override getRuleAggregationVersion(): number {
    return 1
  }
}
