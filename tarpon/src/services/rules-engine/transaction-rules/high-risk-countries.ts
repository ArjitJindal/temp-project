import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { traceable } from '@/core/xray'

export type HighRiskCountryRuleParameters = {
  highRiskCountries: CountryCode[]
}

@traceable
export default class HighRiskCountryRule extends TransactionRule<HighRiskCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<HighRiskCountryRuleParameters> {
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
    const sendingCountry = this.transaction.originAmountDetails?.country
    const receivingCountry = this.transaction.destinationAmountDetails?.country

    const senderHit =
      sendingCountry &&
      this.parameters.highRiskCountries.includes(sendingCountry)
    const receiverHit =
      receivingCountry &&
      this.parameters.highRiskCountries.includes(receivingCountry)

    const hitResult: RuleHitResult = []
    if (senderHit || receiverHit) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: senderHit ? super.getTransactionVars('origin') : undefined,
      })
      hitResult.push({
        direction: 'DESTINATION',
        vars: receiverHit ? super.getTransactionVars('destination') : undefined,
      })
    }
    return hitResult
  }
}
