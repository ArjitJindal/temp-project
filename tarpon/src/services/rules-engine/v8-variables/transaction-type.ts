import { lowerCase, startCase } from 'lodash'
import { TransactionRuleVariable } from './types'
import { createTransactionListRuleVariable } from './utils/variables'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export const TRANSACTION_TYPE: TransactionRuleVariable<TransactionType> =
  createTransactionListRuleVariable<TransactionType>({
    key: 'type',
    label: 'transaction type',
    load: async (transaction) => transaction.type,
    uiDefinition: {
      fieldSettings: {
        listValues: TRANSACTION_TYPES.map((type) => ({
          value: type,
          title: startCase(lowerCase(type)),
        })),
      },
      type: 'select',
    },
  })
