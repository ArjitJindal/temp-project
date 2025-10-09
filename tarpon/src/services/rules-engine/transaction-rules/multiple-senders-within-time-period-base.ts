import { JSONSchemaType } from 'ajv'
import compact from 'lodash/compact'
import mergeWith from 'lodash/mergeWith'
import uniq from 'lodash/uniq'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TIME_WINDOW_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByTime,
} from '../utils/transaction-rule-utils'
import { getNonUserSenderKeyId, getUserSenderKeyId } from '../utils'
import { TransactionAggregationRule } from './aggregation-rule'
import { TimeWindow } from '@/@types/rule/params'
import { getTimestampRange } from '@/services/rules-engine/utils/time-utils'
import { traceable } from '@/core/xray'

type UserType = 'USER' | 'NON_USER'

export type MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: number
  timeWindow: TimeWindow
}

export type SenderReceiverTypes = {
  senderTypes: Array<UserType>
  receiverTypes: Array<UserType>
}

type AggregationData = {
  senderKeys?: string[]
}

@traceable
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
      return {
        ruleHitResult: hitResult,
      }
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
    return {
      ruleHitResult: hitResult,
    }
  }

  private getTransactionSenderUserKey(): string | undefined {
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()

    if (
      (receiverTypes.includes('USER') && this.transaction.destinationUserId) ||
      (receiverTypes.includes('NON_USER') &&
        this.transaction.destinationPaymentDetails)
    ) {
      if (senderTypes.includes('USER') && this.senderUser) {
        return getUserSenderKeyId(this.tenantId, this.transaction)
      } else if (senderTypes.includes('NON_USER') && !this.senderUser) {
        return getNonUserSenderKeyId(this.tenantId, this.transaction)
      }
    }
  }

  private getUserType(
    direction: 'ORIGIN' | 'DESTINATION'
  ): UserType | undefined {
    const { senderTypes, receiverTypes } = this.getSenderReceiverTypes()

    if (direction === 'ORIGIN') {
      if (senderTypes.includes('USER') && this.senderUser) {
        return 'USER'
      }
      if (senderTypes.includes('NON_USER') && !this.senderUser) {
        return 'NON_USER'
      }
    }
    if (direction === 'DESTINATION') {
      if (receiverTypes.includes('USER') && this.receiverUser) {
        return 'USER'
      }
      if (receiverTypes.includes('NON_USER') && !this.receiverUser) {
        return 'NON_USER'
      }
    }
    return undefined
  }

  private async *getTransactionsRawData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const { timeWindow } = this.parameters

    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
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
    for await (const data of generator) {
      yield data.receivingTransactions
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    return isTransactionHistoricalFiltered && direction === 'destination'
  }

  public async rebuildUserAggregation(): Promise<void> {
    let timeAggregatedResult: { [key1: string]: AggregationData } = {}
    for await (const data of this.getTransactionsRawData()) {
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
            (keys1: string[] | undefined, keys2: string[] | undefined) =>
              uniq((keys1 ?? []).concat(keys2 ?? []))
          )
        }
      )
    }

    await this.saveRebuiltRuleAggregations('destination', timeAggregatedResult)
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
      return uniq(
        compact(
          userAggregationData.flatMap(
            (aggregationData) => aggregationData.senderKeys ?? []
          )
        )
      )
    }

    if (this.shouldUseRawData()) {
      const uniqueSenderKeys = new Set<string>()
      for await (const data of this.getTransactionsRawData()) {
        this.getUniqueSendersKeys(data).forEach((key) =>
          uniqueSenderKeys.add(key)
        )
      }
      return Array.from(uniqueSenderKeys)
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
    return await groupTransactionsByTime<AggregationData>(
      senderTransactions,
      async (group) => {
        const uniqueSenders = this.getUniqueSendersKeys(group)
        return {
          senderKeys: uniqueSenders,
        }
      },
      this.getAggregationGranularity()
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

    return compact([...uniqueSenders])
  }

  protected override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    aggregation: AggregationData | undefined
  ): Promise<AggregationData | null> {
    const senderUsers = aggregation?.senderKeys ?? []

    const key = await this.getTransactionSenderUserKey()
    if (key) {
      senderUsers.push(key)
    }

    return {
      senderKeys: uniq(senderUsers),
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }

  protected override getRuleAggregationVersion(): number {
    return 2
  }
}
