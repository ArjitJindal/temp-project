import { JSONSchemaType } from 'ajv'
import { KEY_VALUE_PAIR_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { tagsRuleFilter } from '../utils/rule-utils'
import { UserRuleFilter } from './filter'
import { traceable } from '@/core/xray'

export type UserTagsRuleFilterParameter = {
  userTags?: {
    [key: string]: string[]
  }
}

@traceable
export class UserTagsRuleFilter extends UserRuleFilter<UserTagsRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserTagsRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        userTags: KEY_VALUE_PAIR_OPTIONAL_SCHEMA({
          title: '{{UserAlias}} tags',
          description: 'Filter by {{userAlias}} tags',
          uiSchema: {
            group: 'user',
          },
        }),
      },
    } as any
  }

  public async predicate(): Promise<boolean> {
    const userTags = this.user.tags
    const filterTags = this.parameters.userTags

    return tagsRuleFilter(userTags, filterTags)
  }
}
