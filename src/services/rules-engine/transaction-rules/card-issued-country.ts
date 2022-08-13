import { JSONSchemaType } from 'ajv'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

export type CardIssuedCountryRuleParameters = {
  allowedCountries: string[]
}

export default class CardIssuedCountryRule extends TransactionRule<CardIssuedCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<CardIssuedCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        allowedCountries: {
          type: 'array',
          title: 'Whitelist Countries (ISO 3166-1 alpha-2)',
          items: { type: 'string' },
        },
      },
      required: ['allowedCountries'],
      additionalProperties: false,
    }
  }

  public getFilters() {
    return [() => this.transaction.originPaymentDetails?.method === 'CARD']
  }

  public async computeRule() {
    const { allowedCountries } = this.parameters

    const { cardIssuedCountry } = this.transaction
      .originPaymentDetails as CardDetails

    if (!cardIssuedCountry || !allowedCountries.includes(cardIssuedCountry)) {
      return {
        action: this.action,
        vars: super.getTransactionVars('origin'),
      }
    }
  }
}
