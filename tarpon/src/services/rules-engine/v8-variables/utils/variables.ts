import {
  MultiSelectFieldSettings,
  SelectFieldSettings,
} from '@react-awesome-query-builder/core'
import { COUNTRIES, COUNTRY_CODES } from '@flagright/lib/constants'
import { RuleValueTypesEnum, RuleVariableBase } from '../types'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { CountryCode } from '@/@types/openapi-public/CountryCode'

type Entities = RuleVariableBase['entity']

type RuleParameter<T extends Entities> = T extends 'TRANSACTION'
  ? Transaction
  : T extends 'CONSUMER_USER'
  ? User
  : T extends 'BUSINESS_USER'
  ? Business
  : never

type RuleVariableOptions<
  R,
  ReturnType extends Transaction | User | Business = Transaction
> = {
  key: string
  label: string
  load: (entity: ReturnType) => Promise<R>
  valueType: RuleValueTypesEnum
  uiDefinition?: {
    fieldSettings?: SelectFieldSettings | MultiSelectFieldSettings
    type?: 'text' | 'select'
  }
}

type RuleVariable<
  R,
  T extends
    | 'TRANSACTION'
    | 'CONSUMER_USER'
    | 'BUSINESS_USER'
    | 'PAYMENT_DETAILS'
> = {
  key: string
  entity: T
  valueType: RuleValueTypesEnum
  uiDefinition: {
    label: string
    type: 'text' | 'select'
    valueSources: ['value', 'field', 'func']
    fieldSettings?: SelectFieldSettings | MultiSelectFieldSettings
  }
  load: (entity: RuleParameter<T>) => Promise<R>
}

export const createRuleVariable = <R, T extends Entities>(
  entity: T,
  options: RuleVariableOptions<R, RuleParameter<T>>
): RuleVariable<R, T> => {
  const { key, label, load, uiDefinition } = options

  return {
    key,
    entity,
    valueType: options.valueType || 'string',
    uiDefinition: {
      label,
      type: uiDefinition?.type || 'text',
      valueSources: ['value', 'field', 'func'],
      ...(uiDefinition?.fieldSettings
        ? { fieldSettings: uiDefinition.fieldSettings }
        : {}),
    },
    load,
  }
}

export const createTransactionListRuleVariable = <R>(
  options: Omit<RuleVariableOptions<R, Transaction>, 'valueType'>
): RuleVariable<R, 'TRANSACTION'> => {
  return createRuleVariable<R, 'TRANSACTION'>('TRANSACTION', {
    ...options,
    valueType: 'string',
  })
}

export const createTransactionCountryCodeRuleVariable = (options: {
  key: string
  label: string
  load: (transaction: Transaction) => Promise<CountryCode | undefined>
}): RuleVariable<CountryCode | undefined, 'TRANSACTION'> => {
  return createRuleVariable<CountryCode | undefined, 'TRANSACTION'>(
    'TRANSACTION',
    {
      ...options,
      valueType: 'string',
      uiDefinition: {
        fieldSettings: {
          listValues: COUNTRY_CODES.map((country) => ({
            title: COUNTRIES[country],
            value: country,
          })),
        },
        type: 'select',
      },
    }
  )
}
