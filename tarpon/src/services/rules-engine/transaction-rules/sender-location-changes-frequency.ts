import { JSONSchemaType } from 'ajv'
import { sumBy } from 'lodash'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { TransactionHistoricalFilters } from '../filters'
import { RuleHitResult } from '../rule'
import { getTimestampRange } from '../utils/time-utils'
import {
  getTransactionUserPastTransactionsByDirection,
  groupTransactionsByHour,
} from '../utils/transaction-rule-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { TransactionAggregationRule } from './aggregation-rule'

type AggregationData = {
  ipAddresses: string[]
  transactionsCount: number
}

export type SenderLocationChangesFrequencyRuleParameters = {
  uniqueCitiesCountThreshold: number
  // We could add more granularities like region, timezone and country
  timeWindowInDays: number
}

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
        timeWindowInDays: { type: 'integer', title: 'Time window (days)' },
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    const ipAddress = this.transaction.originDeviceData?.ipAddress

    if (!this.transaction.originUserId || !ipAddress) {
      return
    }

    const { uniqueIpAddresses, transactionsCount } = await this.getData()

    uniqueIpAddresses.add(ipAddress)

    const geoIp = await import('fast-geoip')
    const ipInfos = await Promise.all(
      Array.from(uniqueIpAddresses).map((ipAddress) => geoIp.lookup(ipAddress))
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

  private async getRawTransactionsData(): Promise<AuxiliaryIndexTransaction[]> {
    const { sendingTransactions } =
      await getTransactionUserPastTransactionsByDirection(
        this.transaction,
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
        ['timestamp', 'originDeviceData']
      )

    return sendingTransactions
  }

  private async getData(): Promise<{
    uniqueIpAddresses: Set<string>
    transactionsCount: number
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
        uniqueIpAddresses: new Set(
          userAggregationData.flatMap((v) => v.ipAddresses)
        ),
        transactionsCount: sumBy(
          userAggregationData,
          (data) => data.transactionsCount
        ),
      }
    }

    // Fallback
    if (this.shouldUseRawData()) {
      const sendingTransactions = await this.getRawTransactionsData()

      const sendingTransactionsWithIpAddress = sendingTransactions.filter(
        (transaction) => transaction.originDeviceData?.ipAddress
      )

      // Update aggregations
      await this.saveRebuiltRuleAggregations(
        'origin',
        await this.getTimeAggregatedResult(sendingTransactionsWithIpAddress)
      )

      return {
        uniqueIpAddresses: this.getUniqueIpAddressses(
          sendingTransactionsWithIpAddress
        ),
        transactionsCount: sendingTransactionsWithIpAddress.length,
      }
    } else {
      return {
        uniqueIpAddresses: new Set(),
        transactionsCount: 0,
      }
    }
  }

  public async rebuildUserAggregation(
    direction: 'origin' | 'destination',
    isTransactionFiltered: boolean
  ): Promise<void> {
    const ipAddress = this.transaction.originDeviceData?.ipAddress
    if (
      !isTransactionFiltered ||
      direction === 'destination' ||
      !this.transaction.originUserId ||
      !ipAddress
    ) {
      return
    }

    const transactions = await this.getRawTransactionsData()

    transactions.push(this.transaction)

    // Update aggregations
    await this.saveRebuiltRuleAggregations(
      'origin',
      await this.getTimeAggregatedResult(transactions)
    )
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
    direction: 'origin' | 'destination',
    targetAggregationData: AggregationData | undefined,
    isTransactionFiltered: boolean
  ): Promise<AggregationData | null> {
    const ipAddress = this.transaction.originDeviceData?.ipAddress

    if (
      !isTransactionFiltered ||
      direction === 'destination' ||
      !this.transaction.originUserId ||
      !ipAddress
    ) {
      return null
    }

    return {
      ipAddresses: Array.from(
        new Set((targetAggregationData?.ipAddresses ?? []).concat(ipAddress))
      ),
      transactionsCount: (targetAggregationData?.transactionsCount ?? 0) + 1,
    }
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
