import { JSONSchemaType } from 'ajv'
import {
  OriginPaymentRuleFiltersParameters,
  PaymentFilterRuleFilterBase,
} from './payment-filters-base'

export class OriginPaymentFilterRuleFilter extends PaymentFilterRuleFilterBase<OriginPaymentRuleFiltersParameters> {
  public static getSchema(): JSONSchemaType<OriginPaymentRuleFiltersParameters> {
    return PaymentFilterRuleFilterBase.getBaseSchema<OriginPaymentRuleFiltersParameters>(
      'origin'
    )
  }

  public getDirection(): 'origin' | 'destination' {
    return 'origin'
  }
}
