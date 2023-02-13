import { JSONSchemaType } from 'ajv'
import { TRANSACTION_STATES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export type TransactionStateRuleFilterParameter = {
  transactionStates?: TransactionState[]
}

export class TransactionStateRuleFilter extends TransactionRuleFilter<TransactionStateRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionStateRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionStates: TRANSACTION_STATES_OPTIONAL_SCHEMA({
          uiSchema: {
            group: 'transaction',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return (
      (!!this.transaction.transactionState &&
        this.parameters.transactionStates?.includes(
          this.transaction.transactionState
        )) ||
      false
    )
  }
}
