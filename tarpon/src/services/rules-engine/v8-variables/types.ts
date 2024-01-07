import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'

export interface RuleVariable {
  key: string
  entity:
    | 'TRANSACTION'
    | 'CONSUMER_USER'
    | 'BUSINESS_USER'
    | 'PAYMENT_DETAILS'
    | 'USER'
  valueType: 'string' | 'number' | 'boolean' | 'date'
  uiDefinition: FieldOrGroup
  load: (...args: any[]) => Promise<any>
}

export interface TransactionRuleVariable<ReturnType = unknown>
  extends RuleVariable {
  entity: 'TRANSACTION'
  load: (transaction: Transaction) => Promise<ReturnType>
}

export interface ConsumerUserRuleVariable<ReturnType = unknown>
  extends RuleVariable {
  entity: 'CONSUMER_USER'
  load: (user: User) => Promise<ReturnType>
}

export interface BusinessUserRuleVariable<ReturnType = unknown>
  extends RuleVariable {
  entity: 'BUSINESS_USER'
  load: (user: Business) => Promise<ReturnType>
}
