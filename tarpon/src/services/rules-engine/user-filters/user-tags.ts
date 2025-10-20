import { JSONSchemaType } from 'ajv'
import { KEY_VALUE_PAIR_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { tagsRuleFilter } from '../utils/rule-utils'
import { UserRuleFilter } from './filter'
import { traceable } from '@/core/xray'

export type UserTagsRuleFilterParameter = {
  userTags?: {
    tags: Record<string, string[]>
    useAndLogic?: boolean
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
    return tagsRuleFilter(this.user.tags, {
      tags: this.parameters.userTags?.tags ?? {},
      useAndLogic: this.parameters.userTags?.useAndLogic ?? false,
    })
  }
}
