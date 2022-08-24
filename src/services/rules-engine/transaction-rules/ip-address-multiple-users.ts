import { JSONSchemaType } from 'ajv'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getSenderKeys } from '../utils'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'

export type IpAddressMultipleUsersRuleParameters = {
  uniqueUsersCountThreshold: number
  timeWindowInDays: number
}

export default class IpAddressMultipleUsersRule extends TransactionRule<IpAddressMultipleUsersRuleParameters> {
  public static getSchema(): JSONSchemaType<IpAddressMultipleUsersRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users Count Threshold',
        },
        timeWindowInDays: { type: 'integer', title: 'Time Window (Days)' },
      },
      required: ['uniqueUsersCountThreshold', 'timeWindowInDays'],
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

    const senderKeyId = getSenderKeys(
      this.tenantId,
      this.transaction
    )?.PartitionKeyID

    if (!senderKeyId || !this.transaction.deviceData?.ipAddress) {
      return
    }

    const transactionRepository = new TransactionRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const thinTransactionsFromIpAddress =
      await transactionRepository.getIpAddressThinTransactions(
        this.transaction.deviceData.ipAddress,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        }
      )
    const uniqueUsers = new Set(
      thinTransactionsFromIpAddress
        .map((transaction) => transaction.senderKeyId)
        .concat(senderKeyId)
    )

    if (uniqueUsers.size > uniqueUsersCountThreshold) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars(null),
          ipAddress: this.transaction.deviceData?.ipAddress,
          uniqueUsersCount: uniqueUsers.size,
        },
      }
    }
  }
}
