import { JSONSchemaType } from 'ajv'
import { KEY_VALUE_PAIR_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { tagsRuleFilter } from '../utils/rule-utils'
import { UserRuleFilter } from './filter'

export type UserTagsRuleFilterParameter = {
  userTags?: {
    [key: string]: string
  }
}

export class UserTagsRuleFilter extends UserRuleFilter<UserTagsRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserTagsRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userTags: KEY_VALUE_PAIR_OPTIONAL_SCHEMA({
          title: 'User tags',
          description: 'Filter by user tags',
          uiSchema: {
            group: 'user',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    const userTags = this.user.tags
    const filterTags = this.parameters.userTags

    return tagsRuleFilter(userTags, filterTags)
  }
}
