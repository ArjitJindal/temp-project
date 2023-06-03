import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { isConsumerUser } from '../utils/user-rule-utils'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
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
        transactionAmountThreshold:
          TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA(),
      },
    }
  }

  public async computeRule() {
    if (
      !this.transaction.deviceData?.ipAddress ||
      !this.senderUser ||
      !isConsumerUser(this.senderUser) ||
      (this.senderUser as User).userDetails == null
    ) {
      return
    }

    const geoIp = await import('fast-geoip')
    const ipAddress = this.transaction.deviceData?.ipAddress as string
    const ipInfo = await geoIp.lookup(ipAddress)
    if (!ipInfo?.country) {
      return
    }
    const { transactionAmountThreshold } = this.parameters
    const ipCountry = ipInfo.country
    const consumerUser = this.senderUser as User

    const pastTransactionCountries =
      await this.getUserPastTransactionCountries()
    const expectedCountries = [
      consumerUser.userDetails!.countryOfResidence,
      consumerUser.userDetails!.countryOfNationality,
      ...pastTransactionCountries,
    ].filter(Boolean)

    const thresholdHit = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      _.mapValues(transactionAmountThreshold, (threshold) => ({
        min: threshold,
      }))
    )

    const hitResult: RuleHitResult = []
    if (
      !expectedCountries.includes(ipCountry) &&
      (!this.transaction.originAmountDetails ||
        !transactionAmountThreshold ||
        thresholdHit)
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...super.getTransactionVars('origin'),
          ipCountry,
        },
      })
    }
    return hitResult
  }

  private async getUserPastTransactionCountries(): Promise<Set<string>> {
    const consumerUser = this.senderUser as User
    if (this.aggregationRepository) {
      return (
        await this.aggregationRepository.getUserTransactionCountries(
          consumerUser.userId
        )
      ).sendingFromCountries
    }
    const transactionRepository = this
      .transactionRepository as MongoDbTransactionRepository
    const countries = await transactionRepository.getUniques(
      {
        field: 'COUNTRY',
        direction: 'origin',
      },
      [
        { originUserId: consumerUser.userId },
        { transactionState: 'SUCCESSFUL' },
      ]
    )
    return new Set(countries)
  }
}
