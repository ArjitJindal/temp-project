import { JSONSchemaType } from 'ajv'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'

export type MerchantMonitoringIndustryUserRuleParameters = {
  sourceType: MerchantMonitoringSourceType[]
}

const MERCHANT_SOURCE_TYPES: Array<{
  value: MerchantMonitoringSourceType
  label: string
}> = [
  { value: 'LINKEDIN', label: 'Linkedin' },
  { value: 'EXPLORIUM', label: 'Explorium' },
  { value: 'COMPANIES_HOUSE', label: 'Companies House' },
  { value: 'SCRAPE', label: 'Website scrape' },
]
export default class MerchantMonitoringIndustryUserRule extends UserRule<MerchantMonitoringIndustryUserRuleParameters> {
  public static getSchema(): JSONSchemaType<MerchantMonitoringIndustryUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        sourceType: {
          type: 'array',
          title: 'Source',
          description:
            'Select the sources from which to derive the business industry',
          items: {
            type: 'string',
            enum: MERCHANT_SOURCE_TYPES.map((v) => v.value),
            enumNames: MERCHANT_SOURCE_TYPES.map((v) => v.label),
          },
          uniqueItems: true,
        },
      },
      additionalProperties: false,
      required: ['sourceType'],
    }
  }

  public async computeRule() {
    const hitResult: RuleHitResult = []
    return hitResult
  }
}
