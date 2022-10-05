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

  public getFilters() {
    return [() => this.transaction.originPaymentDetails?.method === 'CARD']
  }

  public async computeRule() {
    const blacklistedCountries = expandCountryGroup(
      this.parameters.blacklistedCountries
    )

    const { cardIssuedCountry } = this.transaction
      .originPaymentDetails as CardDetails

    if (cardIssuedCountry && blacklistedCountries.includes(cardIssuedCountry)) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
  }
}
