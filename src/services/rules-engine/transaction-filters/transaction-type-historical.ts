import { JSONSchemaType } from 'ajv'
import { TRANSACTION_TYPES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export type TransactionTypeHistoricalRuleFilterParameter = {
  transactionTypesHistorical?: TransactionType[]
}

export class TransactionTypeHistoricalRuleFilter extends TransactionRuleFilter<TransactionTypeHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTypeHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTypesHistorical: TRANSACTION_TYPES_OPTIONAL_SCHEMA({
          uiSchema: { group: 'transaction_historical' },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return true
  }
}
