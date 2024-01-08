import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'

export type RuleValueTypesEnum = 'string' | 'number' | 'boolean' | 'date'

export interface RuleVariableBase {
  key: string
  entity: 'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'PAYMENT_DETAILS'
  uiDefinition: FieldOrGroup
  valueType: RuleValueTypesEnum
  load: (...args: any[]) => Promise<any>
}

export interface TransactionRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'TRANSACTION'
  load: (transaction: Transaction) => Promise<ReturnType>
}

export interface ConsumerUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'CONSUMER_USER'
  load: (user: User) => Promise<ReturnType>
}

export interface BusinessUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'BUSINESS_USER'
  load: (user: Business) => Promise<ReturnType>
}
