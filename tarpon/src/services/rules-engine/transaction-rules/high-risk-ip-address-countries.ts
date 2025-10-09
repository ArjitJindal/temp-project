import { JSONSchemaType } from 'ajv'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'

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
    const originIpAddress = this.transaction.originDeviceData?.ipAddress
    const destinationIpAddress =
      this.transaction.destinationDeviceData?.ipAddress

    if (!originIpAddress && !destinationIpAddress) {
      return
    }
    const [originIpInfo, destinationIpInfo] = await Promise.all([
      originIpAddress
        ? this.geoIpService.resolveIpAddress(originIpAddress)
        : null,
      destinationIpAddress
        ? this.geoIpService.resolveIpAddress(destinationIpAddress)
        : null,
    ])
    logger.debug(
      `originIpInfo (${originIpAddress}): ${JSON.stringify(originIpInfo)}`
    )

    const originIpCountry = originIpInfo?.country
    const destinationIpCountry = destinationIpInfo?.country

    if (!originIpCountry && !destinationIpCountry) {
      return
    }

    const ruleHitResult: RuleHitResult = []

    const { highRiskCountries } = this.parameters

    const senderHit =
      originIpCountry &&
      highRiskCountries.includes(originIpCountry as CountryCode)
    const receiverHit =
      destinationIpCountry &&
      highRiskCountries.includes(destinationIpCountry as CountryCode)
    if (senderHit || receiverHit) {
      ruleHitResult.push({
        direction: 'ORIGIN',
        vars: senderHit
          ? {
              ...this.getTransactionVars('origin'),
              ipCountry: originIpCountry,
            }
          : undefined,
      })
      ruleHitResult.push({
        direction: 'DESTINATION',
        vars: receiverHit
          ? {
              ...this.getTransactionVars('destination'),
              ipCountry: destinationIpCountry,
            }
          : undefined,
      })
    }

    return {
      ruleHitResult,
    }
  }
}
