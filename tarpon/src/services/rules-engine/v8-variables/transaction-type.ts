import { lowerCase, startCase } from 'lodash'
import { SelectFieldSettings } from '@react-awesome-query-builder/core'
import { TransactionRuleVariable } from './types'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export const TRANSACTION_TYPE: TransactionRuleVariable<TransactionType> = {
  key: 'type',
  entity: 'TRANSACTION',
  valueType: 'string',
  uiDefinition: {
    label: 'type',
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: TRANSACTION_TYPES.map((type) => ({
        value: type,
        title: startCase(lowerCase(type)),
      })),
    } as SelectFieldSettings,
  },
  load: async (transaction: Transaction) => {
    return transaction.type
  },
}
