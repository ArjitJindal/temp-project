import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { expandCountryGroup } from '@/utils/countries'
import { Transaction } from '@/@types/openapi-public/Transaction'

type TooManyTransactionsToHighRiskCountryRulePartialParameters = {
  highRiskCountries?: string[]
  highRiskCountriesExclusive?: string[]
}
export type TooManyTransactionsToHighRiskCountryRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TooManyTransactionsToHighRiskCountryRulePartialParameters

export default class TooManyTransactionsToHighRiskCountryRule extends TransactionsPatternVelocityBaseRule<TooManyTransactionsToHighRiskCountryRuleParameters> {
  highRiskCountries: string[] | undefined
  highRiskCountriesExclusive: string[] | undefined

  public static getSchema(): JSONSchemaType<TooManyTransactionsToHighRiskCountryRuleParameters> {
    const baseSchema = TransactionsPatternVelocityBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TooManyTransactionsToHighRiskCountryRulePartialParameters> =
      {
        type: 'object',
        properties: {
          highRiskCountries: COUNTRIES_OPTIONAL_SCHEMA({
            title: 'High Risk Countries (ISO 3166-1 alpha-2)',
            description: 'Countries in this list are considered high risk',
          }),
          highRiskCountriesExclusive: COUNTRIES_OPTIONAL_SCHEMA({
            title: 'High Risk Countries (ISO 3166-1 alpha-2) (exclusive)',
            description:
              "Countries that aren't in this list are considered high risk",
          }),
        },
        nullable: true,
      }

    return mergeRuleSchemas<TooManyTransactionsToHighRiskCountryRuleParameters>(
      baseSchema,
      partialSchema
    )
  }

  private isHighRiskCountry(country?: string): boolean {
    if (!country) {
      return false
    }
    if (!this.highRiskCountries) {
      this.highRiskCountries = expandCountryGroup(
        this.parameters.highRiskCountries || []
      )
    }
    if (!this.highRiskCountriesExclusive) {
      this.highRiskCountriesExclusive = expandCountryGroup(
        this.parameters.highRiskCountriesExclusive || []
      )
    }
    return (
      this.highRiskCountries.includes(country) ||
      (this.highRiskCountriesExclusive.length > 0 &&
        !this.highRiskCountriesExclusive.includes(country))
    )
  }

  protected matchPattern(
    transaction: Transaction,
    direction?: 'origin' | 'destination'
  ): boolean {
    return direction === 'origin' && transaction.originAmountDetails?.country
      ? this.isHighRiskCountry(transaction.originAmountDetails?.country)
      : direction === 'destination' &&
        transaction.destinationAmountDetails?.country
      ? this.isHighRiskCountry(transaction.destinationAmountDetails?.country)
      : false
  }
}
