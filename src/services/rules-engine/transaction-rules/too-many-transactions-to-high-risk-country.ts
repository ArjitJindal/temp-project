import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

type TooManyTransactionsToHighRiskCountryRulePartialParameters = {
  highRiskCountries: string[]
}
export type TooManyTransactionsToHighRiskCountryRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TooManyTransactionsToHighRiskCountryRulePartialParameters

export default class TooManyTransactionsToHighRiskCountryRule extends TransactionsPatternVelocityBaseRule<TooManyTransactionsToHighRiskCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<TooManyTransactionsToHighRiskCountryRuleParameters> {
    const baseSchema = TransactionsPatternVelocityBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TooManyTransactionsToHighRiskCountryRulePartialParameters> =
      {
        type: 'object',
        properties: {
          highRiskCountries: {
            type: 'array',
            title: 'High Risk Countries',
            items: { type: 'string' },
          },
        },
        required: ['highRiskCountries'],
      }

    return mergeRuleSchemas<TooManyTransactionsToHighRiskCountryRuleParameters>(
      baseSchema,
      partialSchema
    )
  }

  protected matchPattern(
    transaction: Transaction,
    direction?: 'origin' | 'destination'
  ): boolean {
    return direction === 'origin' && transaction.originAmountDetails?.country
      ? this.parameters.highRiskCountries.includes(
          transaction.originAmountDetails?.country
        )
      : direction === 'destination' &&
        transaction.destinationAmountDetails?.country
      ? this.parameters.highRiskCountries.includes(
          transaction.destinationAmountDetails?.country
        )
      : false
  }
}
