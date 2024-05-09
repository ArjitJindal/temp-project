import { JSONSchemaType } from 'ajv'
import { KEY_VALUE_PAIR_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { tagsRuleFilter } from '../utils/rule-utils'
import { TransactionRuleFilter } from './filter'

export type TransactionTagsRuleFilterParameter = {
  transactionTags?: {
    [key: string]: string[]
  }
}

export class TransactionTagsRuleFilter extends TransactionRuleFilter<TransactionTagsRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTagsRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTags: KEY_VALUE_PAIR_OPTIONAL_SCHEMA({
          title: 'Transaction tags',
          description: 'Filter by transaction tags',
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    const transactionTags = this.transaction.tags
    const filterTags = this.parameters.transactionTags

    return tagsRuleFilter(transactionTags, filterTags)
  }
}
