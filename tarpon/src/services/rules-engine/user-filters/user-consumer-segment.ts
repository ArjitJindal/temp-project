import { JSONSchemaType } from 'ajv'
import { CONSUMER_USER_SEGMENT_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { UserRuleFilter } from './filter'
import { ConsumerUserSegment } from '@/@types/openapi-public/ConsumerUserSegment'
import { User } from '@/@types/openapi-internal/User'

export type ConsumerUserSegmentRuleFilterParameter = {
  consumerUserSegments?: ConsumerUserSegment[]
}

export class ConsumerUserSegmentRuleFilter extends UserRuleFilter<ConsumerUserSegmentRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<ConsumerUserSegmentRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        consumerUserSegments: CONSUMER_USER_SEGMENT_OPTIONAL_SCHEMA({
          title: 'Consumer user segment',
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
    if (!this.parameters.consumerUserSegments?.length) {
      return true
    }

    const user = this.user

    if (!isConsumerUser(user)) {
      return false
    }

    if (!(user as User).userSegment) {
      return false
    }

    return this.parameters.consumerUserSegments?.includes(
      (user as User).userSegment as ConsumerUserSegment
    )
  }
}
