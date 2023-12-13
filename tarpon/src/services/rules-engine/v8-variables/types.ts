import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { Transaction } from '@/@types/openapi-public/Transaction'

export interface RuleVariable {
  key: string
  entity: 'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'PAYMENT_DETAILS'
  uiDefinition: FieldOrGroup
  load: (...args: any[]) => Promise<any>
}
export interface TransactionRuleVariable<ReturnType> extends RuleVariable {
  entity: 'TRANSACTION'
  load: (transaction: Transaction) => Promise<ReturnType>
}
