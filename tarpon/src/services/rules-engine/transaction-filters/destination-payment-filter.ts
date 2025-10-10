import { JSONSchemaType } from 'ajv'
import {
  DestinationPaymentRuleFiltersParameters,
  PaymentFilterRuleFilterBase,
} from './payment-filters-base'

export class DestinationPaymentFilterRuleFilter extends PaymentFilterRuleFilterBase<DestinationPaymentRuleFiltersParameters> {
  public static getSchema(): JSONSchemaType<DestinationPaymentRuleFiltersParameters> {
    return PaymentFilterRuleFilterBase.getBaseSchema<DestinationPaymentRuleFiltersParameters>(
      'destination'
    )
  }

  public getDirection(): 'origin' | 'destination' {
    return 'destination'
  }
}
