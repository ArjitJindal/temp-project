import { JSONSchemaType } from 'ajv'
import { BUSINESS_USER_SEGMENT_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { UserRuleFilter } from './filter'
import { BusinessUserSegment } from '@/@types/openapi-public/BusinessUserSegment'
import { Business } from '@/@types/openapi-internal/Business'

export type BusinessUserSegmentRuleFilterParameter = {
  businessUserSegments?: BusinessUserSegment[]
}

export class BusinessUserSegmentRuleFilter extends UserRuleFilter<BusinessUserSegmentRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<BusinessUserSegmentRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        businessUserSegments: BUSINESS_USER_SEGMENT_OPTIONAL_SCHEMA({
          title: 'Business user segment',
          uiSchema: {
            group: 'user',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    if (!this.parameters.businessUserSegments?.length) {
      return true
    }

    const user = this.user

    if (!isBusinessUser(user)) {
      return false
    }
    const userSegment = (user as Business).legalEntity.companyGeneralDetails
      .userSegment
    if (!userSegment) {
      return false
    }

    return this.parameters.businessUserSegments?.includes(
      userSegment as BusinessUserSegment
    )
  }
}
