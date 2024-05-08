import { JSONSchemaType } from 'ajv'
import { mergeWith, sumBy, uniq } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirectionGenerator,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { lookupIpLocation } from '../utils/geoip'
import { TransactionAggregationRule } from './aggregation-rule'
import { traceable } from '@/core/xray'

type AggregationData = {
  ipAddresses: string[]
  transactionsCount: number
}

export type SenderLocationChangesFrequencyRuleParameters = {
  uniqueCitiesCountThreshold: number
  // We could add more granularities like region, timezone and country
  timeWindow: TimeWindow
}

@traceable
export default class SenderLocationChangesFrequencyRule extends TransactionAggregationRule<
  SenderLocationChangesFrequencyRuleParameters,
  TransactionHistoricalFilters,
  AggregationData
> {
  public static getSchema(): JSONSchemaType<SenderLocationChangesFrequencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueCitiesCountThreshold: {
          type: 'integer',
          title: 'Cities count threshold',
          description:
            'rule is run when the cities count per time window is greater than the threshold',
        },
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindow'],
    }
  }

  public async computeRule() {
    const ipAddress = this.transaction.originDeviceData?.ipAddress

    if (!this.transaction.originUserId || !ipAddress) {
      return
    }

    const { uniqueIpAddresses, transactionsCount } = await this.getData()

    uniqueIpAddresses.add(ipAddress)

    const ipInfos = await Promise.all(
      Array.from(uniqueIpAddresses).map((ipAddress) =>
        lookupIpLocation(ipAddress)
      )
    )

    const uniqueCities = new Set(
      // NOTE: ipInfo.city could be sometimes empty, if it's empty, we use region or country as an approximation
      ipInfos
        .map((ipInfo) => ipInfo?.city || ipInfo?.region || ipInfo?.country)
        .filter(Boolean)
    )
    const hitResult: RuleHitResult = []
    if (uniqueCities.size > this.parameters.uniqueCitiesCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactionsCount: transactionsCount + 1,
          locationsCount: uniqueCities.size,
        },
      })
    }
    return hitResult
  }

  private async *getRawTransactionsData(): AsyncGenerator<
    AuxiliaryIndexTransaction[]
  > {
    const generator = getTransactionUserPastTransactionsByDirectionGenerator(
      this.transaction,
      'origin',
      this.transactionRepository,
      {
        timeWindow: this.parameters.timeWindow,
        checkDirection: 'sending',
        filters: this.filters,
      },
      ['timestamp', 'originDeviceData']
    )
    for await (const data of generator) {
      yield data.sendingTransactions
    }
  }

  private async getData(): Promise<{
    uniqueIpAddresses: Set<string>
    transactionsCount: number
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
        uniqueIpAddresses: new Set(
          userAggregationData.flatMap((v) => v.ipAddresses)
        ),
        transactionsCount: sumBy(
          userAggregationData,
          (data) => data.transactionsCount
        ),
      }
    }

    if (this.shouldUseRawData()) {
      let transactionsCount = 0
      const uniqueIpAddresses = new Set<string>()
      for await (const data of this.getRawTransactionsData()) {
        const sendingTransactionsWithIpAddress = data.filter(
          (transaction) => transaction.originDeviceData?.ipAddress
        )
        const ipAddresses = this.getUniqueIpAddressses(
          sendingTransactionsWithIpAddress
        )
        Array.from(ipAddresses).forEach((ipAddress) =>
          uniqueIpAddresses.add(ipAddress)
        )
        transactionsCount += sendingTransactionsWithIpAddress.length
      }
      return {
        uniqueIpAddresses,
        transactionsCount,
      }
    } else {
      return {
        uniqueIpAddresses: new Set(),
        transactionsCount: 0,
      }
    }
  }

  public shouldUpdateUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionHistoricalFiltered: boolean
  ): boolean {
    const ipAddress = this.transaction.originDeviceData?.ipAddress

    return Boolean(
      isTransactionHistoricalFiltered &&
        direction === 'origin' &&
        this.transaction.originUserId &&
        ipAddress
    )
  }

  public async rebuildUserAggregation(): Promise<void> {
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
            ipAddresses: uniq(
              (a?.ipAddresses ?? []).concat(b?.ipAddresses ?? [])
            ),
            transactionsCount:
              (a?.transactionsCount ?? 0) + (b?.transactionsCount ?? 0),
          }
          return result
        }
      )
    }
    await this.saveRebuiltRuleAggregations('origin', timeAggregatedResult)
  }

  private getUniqueIpAddressses(
    transactions: AuxiliaryIndexTransaction[]
  ): Set<string> {
    return new Set(
      transactions
        .map((transaction) => transaction?.originDeviceData?.ipAddress)
        .filter(Boolean)
    ) as Set<string>
  }

  private async getTimeAggregatedResult(
    sendingTransactionsWithCard: AuxiliaryIndexTransaction[]
  ) {
    return groupTransactionsByHour<AggregationData>(
      sendingTransactionsWithCard,
      async (group) => ({
        transactionsCount: group.length,
        ipAddresses: Array.from(this.getUniqueIpAddressses(group)),
      })
    )
  }

  override async getUpdatedTargetAggregation(
    _direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined
  ): Promise<AggregationData | null> {
    return {
      ipAddresses: Array.from(
        new Set(
          (targetAggregationData?.ipAddresses ?? []).concat(
            this.transaction?.originDeviceData?.ipAddress || []
          )
        )
      ),
      transactionsCount: (targetAggregationData?.transactionsCount ?? 0) + 1,
    }
  }

  override getMaxTimeWindow(): TimeWindow {
    return this.parameters.timeWindow
  }
  protected getRuleAggregationVersion(): number {
    return 2
  }
}
