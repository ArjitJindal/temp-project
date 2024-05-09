import { JSONSchemaType } from 'ajv'
import { USER_STATUS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { UserState } from '@/@types/openapi-internal/UserState'

export type UserStatusRuleFilterParameter = {
  userStatus?: UserState[]
}

export class UserStatusRuleFilter extends UserRuleFilter<UserStatusRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserStatusRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userStatus: USER_STATUS_OPTIONAL_SCHEMA({
          description:
            'Add target user status to only run this rule for users with specified user status',
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
    if (!this.parameters.userStatus?.length) {
      return true
    }

    if (!this.user?.userStateDetails?.state) {
      return false
    }

    return this.parameters.userStatus?.includes(
      this.user?.userStateDetails?.state
    )
  }
}
