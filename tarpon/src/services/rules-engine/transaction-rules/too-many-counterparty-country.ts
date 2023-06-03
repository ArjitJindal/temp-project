import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionsPatternVelocityBaseRule, {
  TransactionsPatternVelocityRuleParameters,
} from './transactions-pattern-velocity-base'
import { Transaction } from '@/@types/openapi-public/Transaction'

type TooManyCounterpartyCountryRulePartialParameters = {
  transactionsLimit: number
}
export type TooManyCounterpartyCountryRuleParameters =
  TransactionsPatternVelocityRuleParameters &
    TooManyCounterpartyCountryRulePartialParameters
export default class TooManyCounterpartyCountryRule extends TransactionsPatternVelocityBaseRule<TooManyCounterpartyCountryRuleParameters> {
  public static getSchema(): JSONSchemaType<TooManyCounterpartyCountryRuleParameters> {
    const baseSchema = TransactionsPatternVelocityBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TooManyCounterpartyCountryRulePartialParameters> =
      {
        type: 'object',
        properties: {
          transactionsLimit: {
            type: 'integer',
            title: 'Unique countries limit',
          },
        },
        required: ['transactionsLimit'],
      }

    return mergeRuleSchemas<TooManyCounterpartyCountryRuleParameters>(
      baseSchema,
      partialSchema
    )
  }
  uniqueCountries: { [key: string]: Set<string> } = {
    sender: new Set<string>(),
    receiver: new Set<string>(),
  }

  override matchPattern(
    transaction: Transaction,
    direction: 'origin' | 'destination',
    userType: 'sender' | 'receiver',
    pure: boolean
  ): boolean {
    const country =
      direction === 'origin'
        ? transaction.originAmountDetails?.country
        : transaction.destinationAmountDetails?.country

    if (!country) {
      return false
    }
    if (this.uniqueCountries[userType].has(country)) {
      return false
    }
    if (!pure) {
      this.uniqueCountries[userType].add(country)
    }
    return true
  }

  override getNeededTransactionFields(): Array<keyof Transaction> {
    return ['originAmountDetails', 'destinationAmountDetails']
  }
  override isAggregationSupported() {
    return false
  }
}
