import { JSONSchemaType } from 'ajv'
import dayjs = require('dayjs')
import { TransactionRepository } from '../repositories/transaction-repository'
import { TRANSACTION_STATE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { MissingRuleParameter } from './errors'
import { DefaultTransactionRuleParameters, TransactionRule } from './rule'

export type SenderLocationChangesFrequencyRuleParameters =
  DefaultTransactionRuleParameters & {
    uniqueCitiesCountThreshold: number
    // We could add more granularities like region, timezone and country
    timeWindowInDays: number
  }

export default class SenderLocationChangesFrequencyRule extends TransactionRule<SenderLocationChangesFrequencyRuleParameters> {
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
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA(),
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindowInDays'],
    }
  }

  public async computeRule() {
    const { uniqueCitiesCountThreshold, timeWindowInDays, transactionState } =
      this.parameters
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
    const thinTransactions =
      await transactionRepository.getUserSendingThinTransactions(
        this.transaction.originUserId,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        { transactionState }
      )
    const transactionsWithIpAddress = [
      ...(await transactionRepository.getTransactionsByIds(
        thinTransactions.map((thinTransaction) => thinTransaction.transactionId)
      )),
      this.transaction,
    ].filter((transaction) => transaction.deviceData?.ipAddress)
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
    if (uniqueCities.size > uniqueCitiesCountThreshold) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          transactionsCount: transactionsWithIpAddress.length,
          locationsCount: uniqueCities.size,
        },
      }
    }
  }
}
