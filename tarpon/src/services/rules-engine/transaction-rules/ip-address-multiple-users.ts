import { JSONSchemaType } from 'ajv'
import { isEmpty } from 'lodash'
import { getSenderKeys } from '../utils'
import { RuleHitResult } from '../rule'
import { MissingRuleParameter } from './errors'
import { TransactionRule } from './rule'
import dayjs from '@/utils/dayjs'
import { getOriginIpAddress } from '@/utils/ipAddress'

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

    const originIpAddress = getOriginIpAddress(this.transaction.deviceData)

    if (!senderKeyId || !originIpAddress) {
      return
    }

    const transactionsFromIpAddress =
      await this.transactionRepository.getIpAddressTransactions(
        originIpAddress,
        {
          afterTimestamp: dayjs(this.transaction.timestamp)
            .subtract(timeWindowInDays, 'day')
            .valueOf(),
          beforeTimestamp: this.transaction.timestamp!,
        },
        ['senderKeyId', 'deviceData']
      )

    const transactionsFromIpAddressUpdated = transactionsFromIpAddress.filter(
      (transaction) => {
        return !isEmpty(getOriginIpAddress(transaction.deviceData))
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
