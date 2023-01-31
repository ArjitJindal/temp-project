import { JSONSchemaType } from 'ajv'
import { TRANSACTION_TYPES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export type TransactionTypeRuleFilterParameter = {
  transactionTypes?: TransactionType[]
}

export class TransactionTypeRuleFilter extends TransactionRuleFilter<TransactionTypeRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTypeRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTypes: TRANSACTION_TYPES_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return this.parameters.transactionTypes!.includes(
      this.transaction.type as TransactionType
    )
  }
}
