import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export type RuleValueTypesEnum =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
export type RuleEntityType =
  | 'TRANSACTION'
  | 'USER'
  | 'CONSUMER_USER'
  | 'BUSINESS_USER'
  | 'PAYMENT_DETAILS'

export interface RuleVariableBase {
  key: string
  entity: RuleEntityType
  uiDefinition: FieldOrGroup
  valueType: RuleValueTypesEnum
  load: (...args: any[]) => Promise<any>
}

export type TransactionRuleVariableContext = {
  baseCurrency?: CurrencyCode
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
}

export interface TransactionRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'TRANSACTION'
  load: (
    transaction: Transaction,
    context: TransactionRuleVariableContext
  ) => Promise<ReturnType>
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

export interface CommonUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'USER'
  load: (
    user: User | Business,
    context: TransactionRuleVariableContext
  ) => Promise<ReturnType>
}
