import { JSONSchemaType } from 'ajv'
import dayjs = require('dayjs')
import { TransactionRepository } from '../repositories/transaction-repository'
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
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        uniqueCitiesCountThreshold: {
          type: 'integer',
          title: 'Cities Count Threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindowInDays'],
      additionalProperties: false,
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
      }
    }
  }
}
