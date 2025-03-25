import { JSONSchemaType } from 'ajv'
import { USER_TYPE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { isBusinessUser, isConsumerUser } from '../utils/user-rule-utils'
import { UserRuleFilter } from './filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserType } from '@/@types/user/user-type'
import { traceable } from '@/core/xray'

export type UserTypeRuleFilterParameter = {
  userType?: UserType
}

@traceable
export class UserTypeRuleFilter extends UserRuleFilter<UserTypeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserTypeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userType: USER_TYPE_OPTIONAL_SCHEMA({
          title: '{{UserAlias}} type',
          description:
            'Select the type of {{userAlias}}s you want the rule to apply to',
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
    return this.parameters.userType
      ? this.isUserType(this.user, this.parameters.userType)
      : false
  }

  private isUserType(user: User | Business, userType: UserType) {
    if (userType === 'CONSUMER') {
      return isConsumerUser(user)
    }
    return isBusinessUser(user)
  }
}
