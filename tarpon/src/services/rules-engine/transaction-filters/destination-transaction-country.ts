import { JSONSchemaType } from 'ajv'
import {
  DestinationTransactionCountryRuleFilterParameter,
  TransactionCountryRuleFilterBase,
} from './transaction-country-base'

export class DestinationTransactionCountryRuleFilter extends TransactionCountryRuleFilterBase<DestinationTransactionCountryRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<DestinationTransactionCountryRuleFilterParameter> {
    return TransactionCountryRuleFilterBase.getBaseSchema<DestinationTransactionCountryRuleFilterParameter>(
      'destination'
    )
  }

  public getDirection(): 'origin' | 'destination' {
    return 'destination'
  }
}
