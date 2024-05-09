import { JSONSchemaType } from 'ajv'
import { TRANSACTION_STATES_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { Transaction } from '@/@types/openapi-public/Transaction'

export function transactionStateRuleFilterPredicate(
  transaction: Transaction,
  transactionStates?: TransactionState[]
) {
  return (
    (!!transaction.transactionState &&
      transactionStates?.includes(transaction.transactionState)) ||
    false
  )
}

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
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__)
      return await this.v8Runner()
    return transactionStateRuleFilterPredicate(
      this.transaction,
      this.parameters.transactionStates
    )
  }
}
