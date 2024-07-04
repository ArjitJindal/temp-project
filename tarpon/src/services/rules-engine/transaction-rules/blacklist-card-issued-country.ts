import { JSONSchemaType } from 'ajv'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { expandCountryGroup } from '@/utils/countries'
import { traceable } from '@/core/xray'

export type BlacklistCardIssuedCountryRuleParameters = {
  blacklistedCountries: string[]
}

@traceable
export default class BlacklistCardIssuedCountryRule extends TransactionRule<BlacklistCardIssuedCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<BlacklistCardIssuedCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        blacklistedCountries: COUNTRIES_SCHEMA({
          title: 'Blacklisted countries (ISO 3166-1 alpha-2)',
        }),
      },
      required: ['blacklistedCountries'],
    }
  }

  public async computeRule() {
    const blacklistedCountries = expandCountryGroup(
      this.parameters.blacklistedCountries
    )

    const { cardIssuedCountry: originCardIssuedCountry } = (this.transaction
      .originPaymentDetails || {}) as CardDetails
    const { cardIssuedCountry: destinationCardIssuedCountry } = (this
      .transaction.destinationPaymentDetails || {}) as CardDetails

    const hitResult: RuleHitResult = []
    const senderHit =
      originCardIssuedCountry &&
      blacklistedCountries.includes(originCardIssuedCountry)
    const receiverHit =
      destinationCardIssuedCountry &&
      blacklistedCountries.includes(destinationCardIssuedCountry)
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
