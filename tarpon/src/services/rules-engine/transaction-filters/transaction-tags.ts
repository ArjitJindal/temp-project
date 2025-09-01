import { JSONSchemaType } from 'ajv'
import { KEY_VALUE_PAIR_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { tagsRuleFilter } from '../utils/rule-utils'
import { TransactionRuleFilter } from './filter'

export type TransactionTagsRuleFilterParameter = {
  transactionTags?: Record<string, string[]>
  useAndLogic?: boolean
}

export const transactionTagsRuleFilterSchema: JSONSchemaType<TransactionTagsRuleFilterParameter> =
  {
    type: 'object',
    properties: {
      transactionTags: KEY_VALUE_PAIR_OPTIONAL_SCHEMA({
        title: 'Transaction tags',
        description: 'Filter by transaction tags',
        uiSchema: {
          group: 'transaction',
        },
      }) as any,
      useAndLogic: {
        type: 'boolean',
        nullable: true,
        default: false,
      },
    },
    required: [],
    additionalProperties: false,
  }

export class TransactionTagsRuleFilter extends TransactionRuleFilter<TransactionTagsRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTagsRuleFilterParameter> {
    return transactionTagsRuleFilterSchema
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }

    const transactionTags = this.transaction.tags
    const filterTags = this.parameters.transactionTags
    const useAndLogic = this.parameters.useAndLogic
    console.log(
      transactionTags,
      'transactionTags',
      filterTags,
      'filterTags',
      'useAndLogic',
      useAndLogic
    )
    return tagsRuleFilter(transactionTags, filterTags, useAndLogic)
  }
}
