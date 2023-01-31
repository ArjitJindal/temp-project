import { JSONSchemaType } from 'ajv'
import { TRANSACTION_STATE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export type TransactionStateRuleFilterParameter = {
  transactionState?: TransactionState
}

export class TransactionStateRuleFilter extends TransactionRuleFilter<TransactionStateRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionStateRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionState: TRANSACTION_STATE_OPTIONAL_SCHEMA({
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return (
      this.transaction.transactionState === this.parameters.transactionState
    )
  }
}
