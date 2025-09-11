import { JSONSchemaType } from 'ajv'
import isEmpty from 'lodash/isEmpty'
import { getSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { TIME_WINDOW_SCHEMA, TimeWindow } from '../utils/rule-parameter-schemas'
import { getTimestampRange } from '../utils/time-utils'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import { traceable } from '@/core/xray'

export type IpAddressMultipleUsersRuleParameters = {
  uniqueUsersCountThreshold: number
  timeWindow: TimeWindow
}

@traceable
export default class IpAddressMultipleUsersRule extends TransactionRule<IpAddressMultipleUsersRuleParameters> {
  public static getSchema(): JSONSchemaType<IpAddressMultipleUsersRuleParameters> {
    return {
      type: 'object',
      properties: {
        uniqueUsersCountThreshold: {
          type: 'integer',
          title: 'Users count threshold',
          description: 'Rule is run when users count is greater than threshold',
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

    const originIpAddress = this.transaction.originDeviceData?.ipAddress

    if (!senderKeyId || !originIpAddress) {
      return
    }
    const { afterTimestamp, beforeTimestamp } = getTimestampRange(
      this.transaction.timestamp ?? 0,
      timeWindow
    )
    const transactionsFromIpAddress =
      await this.transactionRepository.getIpAddressTransactions(
        originIpAddress,
        {
          afterTimestamp: afterTimestamp,
          beforeTimestamp: beforeTimestamp,
        },
        ['senderKeyId', 'originDeviceData']
      )

    const transactionsFromIpAddressUpdated = transactionsFromIpAddress.filter(
      (transaction) => {
        return transaction && !isEmpty(transaction?.originDeviceData?.ipAddress)
      }
    )

    const uniqueUsers = new Set(
      transactionsFromIpAddressUpdated
        .map((transaction) => transaction.senderKeyId)
        .concat(senderKeyId)
    )

    const hitResult: RuleHitResult = []
    if (uniqueUsers.size > uniqueUsersCountThreshold) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          ipAddress: originIpAddress,
          uniqueUsersCount: uniqueUsers.size,
        },
      })
    }
    return hitResult
  }
}
