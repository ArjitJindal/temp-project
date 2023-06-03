import { JSONSchemaType } from 'ajv'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { transactionCountryRuleFilterPredicate } from './transaction-country'

export type TransactionCountryHistoricalRuleFilterParameter = {
  transactionCountriesHistorical?: string[]
}

export class TransactionCountryHistoricalRuleFilter extends TransactionRuleFilter<TransactionCountryHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionCountryHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionCountriesHistorical: COUNTRIES_OPTIONAL_SCHEMA({
          title: 'Transaction countries',
          description:
            'Filters origin and destination countries indside the payment details on which the rule will be applied',
          uiSchema: {
            group: 'transaction_historical',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return transactionCountryRuleFilterPredicate(
      this.transaction,
      this.parameters.transactionCountriesHistorical
    )
  }
}
