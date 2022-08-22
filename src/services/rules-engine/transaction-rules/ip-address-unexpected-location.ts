import { isConsumerUser } from '../utils/user-rule-utils'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { TransactionRule } from './rule'
import { User } from '@/@types/openapi-public/User'

export default class IpAddressUnexpectedLocationRule extends TransactionRule<unknown> {
  public static getSchema(): any {
    return {}
  }

  public getFilters() {
    return [
      () => this.transaction.deviceData?.ipAddress !== undefined,
      () => this.senderUser !== undefined && isConsumerUser(this.senderUser),
    ]
  }

  public async computeRule() {
    const geoIp = await import('fast-geoip')
    const ipAddress = this.transaction.deviceData?.ipAddress as string
    const ipInfo = await geoIp.lookup(ipAddress)
    if (!ipInfo?.country) {
      return
    }
    const ipCountry = ipInfo.country
    const consumerUser = this.senderUser as User
    const aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    const expectedCountries = [
      consumerUser.userDetails.countryOfResidence,
      consumerUser.userDetails.countryOfNationality,
      ...(
        await aggregationRepository.getUserTransactionCountries(
          consumerUser.userId
        )
      ).sendingFromCountries,
    ].filter(Boolean)

    if (!expectedCountries.includes(ipCountry)) {
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
