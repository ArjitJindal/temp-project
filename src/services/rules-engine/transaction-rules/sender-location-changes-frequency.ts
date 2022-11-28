import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { TransactionFilters } from '../transaction-filters'
import { RuleHitResult } from '../rule'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import { Transaction } from '@/@types/openapi-public/Transaction'
import dayjs from '@/utils/dayjs'

export type SenderLocationChangesFrequencyRuleParameters = {
  uniqueCitiesCountThreshold: number
  // We could add more granularities like region, timezone and country
  timeWindowInDays: number
}

export default class SenderLocationChangesFrequencyRule extends TransactionRule<
  SenderLocationChangesFrequencyRuleParameters,
  TransactionFilters
> {
  public static getSchema(): JSONSchemaType<SenderLocationChangesFrequencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueCitiesCountThreshold: {
          type: 'integer',
          title: 'Cities Count Threshold',
          description:
            'rule is run when the cities count per time window is greater than the threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    const { uniqueCitiesCountThreshold, timeWindowInDays } = this.parameters
    if (
      uniqueCitiesCountThreshold === undefined ||
      timeWindowInDays === undefined
    ) {
      throw new MissingRuleParameter()
    }

    if (
      !this.transaction.deviceData?.ipAddress ||
      !this.transaction.originUserId
    ) {
      return
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const transactionsWithIpAddress = (
      (await transactionRepository.getUserSendingTransactions(
        this.transaction.originUserId,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        {
          transactionState: this.filters.transactionState,
          transactionTypes: this.filters.transactionTypes,
          originPaymentMethod: this.filters.paymentMethod,
          originCountries: this.filters.transactionCountries,
        },
        ['deviceData']
      )) as Transaction[]
    )
      .concat(this.transaction)
      .filter((transaction) => transaction.deviceData?.ipAddress)
    const geoIp = await import('fast-geoip')
    const ipInfos = await Promise.all(
      transactionsWithIpAddress.map((transaction) =>
        geoIp.lookup(transaction.deviceData?.ipAddress as string)
      )
    )
    const uniqueCities = new Set(
      // NOTE: ipInfo.city could be sometimes empty, if it's empty, we use region or country as an approximation
      ipInfos
        .map((ipInfo) => ipInfo?.city || ipInfo?.region || ipInfo?.country)
        .filter(Boolean)
    )
    const hitResult: RuleHitResult = []
    if (uniqueCities.size > uniqueCitiesCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          transactionsCount: transactionsWithIpAddress.length,
          locationsCount: uniqueCities.size,
        },
      })
    }
    return hitResult
  }
}
