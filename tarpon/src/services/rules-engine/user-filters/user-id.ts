import { JSONSchemaType } from 'ajv'
import { UserRuleFilter } from './filter'
import { uiSchema } from '@/services/rules-engine/utils/rule-schema-utils'

export type UserIdRuleFilterParameter = {
  userIds?: string[]
}

export class UserIdRuleFilter extends UserRuleFilter<UserIdRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserIdRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          title: 'Target user ID',
          description:
            'Add target user IDs to only run this rule for certain users',
          items: { type: 'string' },
          uniqueItems: true,
          nullable: true,
          ...uiSchema({ group: 'user' }),
        },
      },
    }
  }
  public async predicate(): Promise<boolean> {
    return this.parameters.userIds === undefined
      ? false
      : this.parameters.userIds.includes(this.user.userId)
  }
}
