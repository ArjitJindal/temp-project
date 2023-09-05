import { JSONSchemaType } from 'ajv'
import {
  OriginTransactionCountryRuleFilterParameter,
  TransactionCountryRuleFilterBase,
} from './transaction-country-base'

export class OriginTransactionCountryRuleFilter extends TransactionCountryRuleFilterBase<OriginTransactionCountryRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<OriginTransactionCountryRuleFilterParameter> {
    return TransactionCountryRuleFilterBase.getBaseSchema<OriginTransactionCountryRuleFilterParameter>(
      'origin'
    )
  }

  public getDirection(): 'origin' | 'destination' {
    return 'origin'
  }
}
