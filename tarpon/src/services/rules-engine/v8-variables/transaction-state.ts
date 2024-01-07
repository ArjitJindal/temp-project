import { lowerCase, startCase } from 'lodash'
import { TransactionRuleVariable } from './types'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export const TRANSACTION_STATE: TransactionRuleVariable<TransactionState> = {
  key: 'state',
  entity: 'TRANSACTION',
  valueType: 'string',
  uiDefinition: {
    label: 'state',
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: TRANSACTION_STATES.map((state) => ({
        value: state,
        title: startCase(lowerCase(state)),
      })),
    },
  },
  load: async (transaction: Transaction) => {
    return transaction.transactionState!
  },
}
