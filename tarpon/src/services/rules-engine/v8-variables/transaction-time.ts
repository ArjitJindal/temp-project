import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { getSecondsFromTimestamp } from '@flagright/lib/utils/time'
import { TransactionRuleVariable } from './types'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Transaction } from '@/@types/openapi-public/Transaction'

const getUiDefinition = (): FieldOrGroup => ({
  label: `time`,
  type: 'time',
  preferWidgets: ['time'],
  valueSources: ['value', 'field', 'func'],
  fieldSettings: {
    timeFormat: 'HH:mm:ss',
  },
})

export const TRANSACTION_TIME: TransactionRuleVariable = {
  key: 'time',
  entity: 'TRANSACTION',
  valueType: 'number',
  uiDefinition: getUiDefinition(),
  load: async (transaction: InternalTransaction | Transaction) =>
    getSecondsFromTimestamp(transaction.timestamp),
  sourceField: 'timestamp',
}
