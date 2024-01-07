import { COUNTRY_CODES, COUNTRIES } from '@flagright/lib/constants'
import { SelectFieldSettings } from '@react-awesome-query-builder/core'
import { TransactionRuleVariable } from './types'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { Transaction } from '@/@types/openapi-public/Transaction'

interface RuleVariableConfig {
  key: string
  label: string
  load: (transaction: Transaction) => CountryCode | undefined
}

const createTransactionRuleVariable = ({
  key,
  label,
  load,
}: RuleVariableConfig): TransactionRuleVariable<CountryCode | undefined> => ({
  key,
  entity: 'TRANSACTION',
  valueType: 'string',
  uiDefinition: {
    label,
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: COUNTRY_CODES.map((country) => ({
        title: COUNTRIES[country],
        value: country,
      })),
    } as SelectFieldSettings,
  },
  load: async (transaction) => load(transaction),
})

export const TRANSACTION_ORIGIN_COUNTRY = createTransactionRuleVariable({
  key: 'transaction.originAmountDetails.country',
  label: 'origin country',
  load: (transaction) => transaction.originAmountDetails?.country,
})

export const TRANSACTION_DESTINATION_COUNTRY = createTransactionRuleVariable({
  key: 'transaction.destinationAmountDetails.country',
  label: 'destination country',
  load: (transaction) => transaction.destinationAmountDetails?.country,
})
