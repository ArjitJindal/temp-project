import { JSONSchemaType } from 'ajv'
import { TRANSACTION_STATES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export type TransactionStateHistoricalRuleFilterParameter = {
  transactionStatesHistorical?: TransactionState[]
}

export class TransactionStateHistoricalRuleFilter extends TransactionRuleFilter<TransactionStateHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionStateHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionStatesHistorical: TRANSACTION_STATES_OPTIONAL_SCHEMA({
          uiSchema: {
            group: 'transaction_historical',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return true
  }
}
