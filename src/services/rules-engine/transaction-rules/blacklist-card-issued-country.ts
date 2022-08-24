import { JSONSchemaType } from 'ajv'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type BlacklistCardIssuedCountryRuleParameters = {
  blacklistedCountries: string[]
}

export default class BlacklistCardIssuedCountryRule extends TransactionRule<BlacklistCardIssuedCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<BlacklistCardIssuedCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        blacklistedCountries: {
          type: 'array',
          title: 'Blacklisted Countries (ISO 3166-1 alpha-2)',
          items: { type: 'string' },
        },
      },
      required: ['blacklistedCountries'],
    }
  }

  public getFilters() {
    return [() => this.transaction.originPaymentDetails?.method === 'CARD']
  }

  public async computeRule() {
    const { blacklistedCountries } = this.parameters

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
