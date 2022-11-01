import { JSONSchemaType } from 'ajv'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { expandCountryGroup } from '@/utils/countries'

export type BlacklistCardIssuedCountryRuleParameters = {
  blacklistedCountries: string[]
}

export default class BlacklistCardIssuedCountryRule extends TransactionRule<BlacklistCardIssuedCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<BlacklistCardIssuedCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        blacklistedCountries: COUNTRIES_SCHEMA({
          title: 'Blacklisted Countries (ISO 3166-1 alpha-2)',
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

    if (
      originCardIssuedCountry &&
      blacklistedCountries.includes(originCardIssuedCountry)
    ) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
    if (
      destinationCardIssuedCountry &&
      blacklistedCountries.includes(destinationCardIssuedCountry)
    ) {
      return {
        action: this.action,
        vars: super.getTransactionVars('destination'),
      }
    }
  }
}
