import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { isConsumerUser } from '../utils/user-rule-utils'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'

export type IpAddressUnexpectedLocationRuleParameters = {
  transactionAmountThreshold?: {
    [currency: string]: number
  }
}

export default class IpAddressUnexpectedLocationRule extends TransactionRule<IpAddressUnexpectedLocationRuleParameters> {
  public static getSchema(): JSONSchemaType<IpAddressUnexpectedLocationRuleParameters> {
    return {
      type: 'object',
      properties: {
        transactionAmountThreshold: {
          type: 'object',
          title: 'Transaction Amount Threshold',
          additionalProperties: {
            type: 'integer',
          },
          required: [],
          nullable: true,
        },
      },
    }
  }

  public getFilters() {
    return [
      () => this.transaction.deviceData?.ipAddress !== undefined,
      () => this.senderUser !== undefined && isConsumerUser(this.senderUser),
      () => !!(this.senderUser as User).userDetails,
    ]
  }

  public async computeRule() {
    const geoIp = await import('fast-geoip')
    const ipAddress = this.transaction.deviceData?.ipAddress as string
    const ipInfo = await geoIp.lookup(ipAddress)
    if (!ipInfo?.country) {
      return
    }
    const { transactionAmountThreshold } = this.parameters
    const ipCountry = ipInfo.country
    const consumerUser = this.senderUser as User
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const expectedCountries = [
      consumerUser.userDetails!.countryOfResidence,
      consumerUser.userDetails!.countryOfNationality,
      ...(
        await aggregationRepository.getUserTransactionCountries(
          consumerUser.userId
        )
      ).sendingFromCountries,
    ].filter(Boolean)

    const thresholdHit = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      _.mapValues(transactionAmountThreshold, (threshold) => ({
        min: threshold,
      }))
    )

    if (
      !expectedCountries.includes(ipCountry) &&
      (!this.transaction.originAmountDetails ||
        !transactionAmountThreshold ||
        thresholdHit)
    ) {
      return {
        action: this.action,
        vars: {
          ...super.getTransactionVars('origin'),
          ipCountry,
        },
      }
    }
  }
}
