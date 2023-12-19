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
  uiDefinition: FieldOrGroup
  load: (...args: any[]) => Promise<any>
}

export interface TransactionRuleVariable<ReturnType> extends RuleVariable {
  entity: 'TRANSACTION'
  load: (transaction: Transaction) => Promise<ReturnType>
}

export interface UserRuleVariable<ReturnType> extends RuleVariable {
  entity: 'USER'
  load: (user: User | Business) => Promise<ReturnType>
}
