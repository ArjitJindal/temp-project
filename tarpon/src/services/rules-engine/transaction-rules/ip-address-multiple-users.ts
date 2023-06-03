import { JSONSchemaType } from 'ajv'
import { getSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
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
          title: 'Users count threshold',
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

    const transactionsFromIpAddress =
      await this.transactionRepository.getIpAddressTransactions(
        this.transaction.deviceData.ipAddress,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        ['senderKeyId', 'deviceData']
      )
    const uniqueUsers = new Set(
      transactionsFromIpAddress
        .map((transaction) => transaction.senderKeyId)
        .concat(senderKeyId)
    )

    const hitResult: RuleHitResult = []
    if (uniqueUsers.size > uniqueUsersCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          ipAddress: this.transaction.deviceData?.ipAddress,
          uniqueUsersCount: uniqueUsers.size,
        },
      })
    }
    return hitResult
  }
}
