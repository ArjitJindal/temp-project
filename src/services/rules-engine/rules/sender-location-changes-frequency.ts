import { JSONSchemaType } from 'ajv'
import dayjs = require('dayjs')
import { TransactionRepository } from '../repositories/transaction-repository'
import { MissingRuleParameter } from './errors'
import { Rule } from './rule'

export type SenderLocationChangesFrequencyRuleParameters = {
  uniqueCitiesCountThreshold: number
  // We could add more granularities like region, timezone and country
  timeWindowInDays: number
}

export default class SenderLocationChangesFrequencyRule extends Rule<SenderLocationChangesFrequencyRuleParameters> {
  public static getSchema(): JSONSchemaType<SenderLocationChangesFrequencyRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueCitiesCountThreshold: { type: 'integer' },
        timeWindowInDays: { type: 'integer' },
      },
      required: ['uniqueCitiesCountThreshold', 'timeWindowInDays'],
      additionalProperties: false,
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
    const thinTransactions =
      await transactionRepository.getAfterTimeUserSendingThinTransactions(
        this.transaction.originUserId,
        dayjs
          .unix(this.transaction.timestamp)
          .subtract(timeWindowInDays, 'day')
          .unix()
      )
    const transactionsWithIpAddress = [
      ...(await transactionRepository.getTransactionsByIds(
        thinTransactions.map((thinTransaction) => thinTransaction.transactionId)
      )),
      this.transaction,
    ].filter((transaction) => transaction.deviceData?.ipAddress)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const geoIp = require('fast-geoip')
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
