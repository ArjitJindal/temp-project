import { JSONSchemaType } from 'ajv'
import { getSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'

export type IpAddressMultipleUsersRuleParameters = {
  uniqueUsersCountThreshold: number
  timeWindow: TimeWindow
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
        timeWindow: TIME_WINDOW_SCHEMA(),
      },
      required: ['uniqueUsersCountThreshold', 'timeWindow'],
    }
  }

  public async computeRule() {
    const { uniqueUsersCountThreshold, timeWindow } = this.parameters
    if (uniqueUsersCountThreshold === undefined || timeWindow === undefined) {
      throw new MissingRuleParameter()
    }

    const senderKeyId = getSenderKeys(
      this.tenantId,
      this.transaction
    )?.PartitionKeyID

    if (!senderKeyId || !this.transaction.deviceData?.ipAddress) {
      return
    }
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp!,
      timeWindow
    )
    const transactionsFromIpAddress =
      await this.transactionRepository.getIpAddressTransactions(
        this.transaction.deviceData.ipAddress,
        {
          afterTimestamp: afterTimestamp,
          beforeTimestamp: beforeTimestamp,
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
