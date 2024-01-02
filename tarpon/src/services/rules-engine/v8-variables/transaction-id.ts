import { TransactionRuleVariable } from './types'
import { Transaction } from '@/@types/openapi-public/Transaction'

export const TRANSACTION_ID: TransactionRuleVariable<string> = {
  key: 'id',
  entity: 'TRANSACTION',
  uiDefinition: {
    label: 'id',
    type: 'text',
    valueSources: ['value', 'field', 'func'],
  },
  load: async (transaction: Transaction) => {
    return transaction.transactionId
  },
}
