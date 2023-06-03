import { JSONSchemaType } from 'ajv'
import { COUNTRIES_SCHEMA } from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { TransactionRule } from './rule'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { expandCountryGroup } from '@/utils/countries'

export type CardIssuedCountryRuleParameters = {
  allowedCountries: string[]
}

export default class CardIssuedCountryRule extends TransactionRule<CardIssuedCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<CardIssuedCountryRuleParameters> {
    return {
      type: 'object',
      properties: {
        allowedCountries: COUNTRIES_SCHEMA({
          title: 'Whitelist countries (ISO 3166-1 alpha-2)',
        }),
      },
      required: ['allowedCountries'],
    }
  }

  public async computeRule() {
    if (this.transaction.originPaymentDetails?.method !== 'CARD') {
      return
    }

    const allowedCountries = expandCountryGroup(
      this.parameters.allowedCountries
    )

    const { cardIssuedCountry } = this.transaction
      .originPaymentDetails as CardDetails

    const hitResult: RuleHitResult = []
    if (!cardIssuedCountry || !allowedCountries.includes(cardIssuedCountry)) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: super.getTransactionVars('origin'),
      })
    }
    return hitResult
  }
}
