import { JSONSchemaType } from 'ajv'
import dayjs from 'dayjs'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getSenderKeys } from '../utils'
import { MissingRuleParameter } from './errors'
import { Rule } from './rule'

export type IpAddressMultipleUsersRuleParameters = {
  uniqueUsersCountThreshold: number
  timeWindowInDays: number
}

export default class IpAddressMultipleUsersRule extends Rule<IpAddressMultipleUsersRuleParameters> {
  public static getSchema(): JSONSchemaType<IpAddressMultipleUsersRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: { type: 'integer' },
        timeWindowInDays: { type: 'integer' },
      },
      required: ['uniqueUsersCountThreshold', 'timeWindowInDays'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { uniqueUsersCountThreshold, timeWindowInDays } = this.parameters
    if (
      uniqueUsersCountThreshold === undefined ||
      timeWindowInDays === undefined
    ) {
      throw new MissingRuleParameter()
    }

    if (!this.transaction.deviceData?.ipAddress) {
      return
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const thinTransactionsFromIpAddress =
      await transactionRepository.getAfterTimestampIpAddressThinTransactions(
        this.transaction.deviceData.ipAddress,
        dayjs
          .unix(this.transaction.timestamp)
          .subtract(timeWindowInDays, 'day')
          .unix()
      )
    const senderKeyId = getSenderKeys(
      this.tenantId,
      this.transaction
    ).PartitionKeyID
    const uniqueUsers = new Set(
      thinTransactionsFromIpAddress
        .map((transaction) => transaction.senderKeyId)
        .concat(senderKeyId)
    )

    if (uniqueUsers.size > uniqueUsersCountThreshold) {
      return {
        action: this.action,
      }
    }
  }
}
