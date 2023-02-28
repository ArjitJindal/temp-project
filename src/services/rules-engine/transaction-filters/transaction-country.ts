import { JSONSchemaType } from 'ajv'
import { COUNTRIES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { expandCountryGroup } from '@/utils/countries'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function transactionCountryRuleFilterPredicate(
  transaction: Transaction,
  transactionCountries?: string[]
) {
  if (!transactionCountries) {
    return true
  }
  transactionCountries = expandCountryGroup(transactionCountries)
  return (
    transactionCountries.some(
      (x) => x === transaction.originAmountDetails?.country
    ) ||
    transactionCountries.some(
      (x) => x === transaction.destinationAmountDetails?.country
    )
  )
}

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
    return transactionCountryRuleFilterPredicate(
      this.transaction,
      this.parameters.transactionCountries
    )
  }
}
