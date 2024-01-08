import { lowerCase, startCase } from 'lodash'
import { createTransactionListRuleVariable } from './utils/variables'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export const TRANSACTION_STATE = createTransactionListRuleVariable<
  TransactionState | undefined
>({
  key: 'transaction.transactionState',
  label: 'transaction state',
  load: async (transaction) => transaction.transactionState,
  uiDefinition: {
    fieldSettings: {
      listValues: TRANSACTION_STATES.map((state) => ({
        value: state,
        title: startCase(lowerCase(state)),
      })),
    },
    type: 'select',
  },
})
