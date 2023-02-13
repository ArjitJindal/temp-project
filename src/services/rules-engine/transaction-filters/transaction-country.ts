import { JSONSchemaType } from 'ajv'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { expandCountryGroup } from '@/utils/countries'

export type TransactionCountryRuleFilterParameter = {
  transactionCountries?: string[]
}

export class TransactionCountryRuleFilter extends TransactionRuleFilter<TransactionCountryRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionCountryRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Transaction Countries',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    let { transactionCountries } = this.parameters
    if (!transactionCountries) {
      return true
    }
    transactionCountries = expandCountryGroup(transactionCountries)
    return (
      transactionCountries.some(
        (x) => x === this.transaction.originAmountDetails?.country
      ) ||
      transactionCountries.some(
        (x) => x === this.transaction.destinationAmountDetails?.country
      )
    )
  }
}
