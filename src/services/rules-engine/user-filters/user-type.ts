import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import { USER_TYPE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserType } from '@/@types/user/user-type'

export type UserTypeRuleFilterParameter = {
  userType?: UserType
}

export default class UserTypeRuleFilter extends UserRuleFilter<UserTypeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserTypeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userType: USER_TYPE_OPTIONAL_SCHEMA(),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return this.isUserType(this.user, this.parameters.userType)
  }

  private isUserType(user: User | Business, userType: UserType | undefined) {
    if (!userType) {
      return true
    }
    if (!user) {
      return false
    }
    if (userType === 'CONSUMER') {
      return this.isConsumerUser(user)
    }
    return this.isBusinessUser(user)
  }

  private isConsumerUser(user: User | Business) {
    return (user as User).userDetails !== undefined
  }

  private isBusinessUser(user: User | Business) {
    return !this.isConsumerUser(user)
  }
}
