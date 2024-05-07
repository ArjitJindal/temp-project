import { JSONSchemaType } from 'ajv'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { traceable } from '@/core/xray'

export type HighRiskIpAddressCountriesParameters = {
  highRiskCountries: CountryCode[]
}

@traceable
export class HighRiskIpAddressCountries extends TransactionRule<HighRiskIpAddressCountriesParameters> {
  public static getSchema(): JSONSchemaType<HighRiskIpAddressCountriesParameters> {
    return {
      type: 'object',
      properties: {
        highRiskCountries: COUNTRIES_SCHEMA({
          title: 'High risk countries',
          description: 'List of high risk countries',
        }),
      },
      required: ['highRiskCountries'],
    }
  }

  public async computeRule() {
    const geoIp = await import('geoip-lite')
    const originIpAddress = this.transaction.originDeviceData?.ipAddress
    const destinationIpAddress =
      this.transaction.destinationDeviceData?.ipAddress

    if (!originIpAddress && !destinationIpAddress) {
      return
    }

    const originIpInfo = originIpAddress
      ? geoIp.lookup(originIpAddress)
      : undefined
    const destinationIpInfo = destinationIpAddress
      ? geoIp.lookup(destinationIpAddress)
      : undefined

    const originIpCountry = originIpInfo?.country
    const destinationIpCountry = destinationIpInfo?.country

    if (!originIpCountry && !destinationIpCountry) {
      return
    }

    const ruleHitResult: RuleHitResult = []

    const { highRiskCountries } = this.parameters

    if (
      originIpCountry &&
      highRiskCountries.includes(originIpCountry as CountryCode)
    ) {
      ruleHitResult.push({
        direction: 'ORIGIN',
        vars: {
          ...this.getTransactionVars('origin'),
          ipCountry: originIpCountry,
        },
      })
    }

    if (
      destinationIpCountry &&
      highRiskCountries.includes(destinationIpCountry as CountryCode)
    ) {
      ruleHitResult.push({
        direction: 'DESTINATION',
        vars: {
          ...this.getTransactionVars('destination'),
          ipCountry: destinationIpCountry,
        },
      })
    }

    return ruleHitResult
  }
}
