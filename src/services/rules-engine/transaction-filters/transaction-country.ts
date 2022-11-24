import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { expandCountryGroup } from '@/utils/countries'

export type CountryRuleFilterParameter = {
  transactionCountries?: string[]
}

export default class CountryRuleFilter extends TransactionRuleFilter<CountryRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<CountryRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionCountries: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Transaction Countries',
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
