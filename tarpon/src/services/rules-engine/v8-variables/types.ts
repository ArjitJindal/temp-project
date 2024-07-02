import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  AuxiliaryIndexTransaction,
  TransactionWithRiskDetails,
} from '../repositories/transaction-repository-interface'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { Feature } from '@/@types/openapi-internal/Feature'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

export type RuleValueTypesEnum =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
export type RuleEntityType =
  | 'TRANSACTION'
  | 'TRANSACTION_EVENT'
  | 'USER'
  | 'CONSUMER_USER'
  | 'BUSINESS_USER'
  | 'PAYMENT_DETAILS'

export interface RuleVariableBase {
  key: string
  entity: RuleEntityType
  uiDefinition: FieldOrGroup
  valueType: RuleValueTypesEnum
  requiredFeatures?: Feature[]
  load: (...args: any[]) => Promise<any>
}

export type RuleVariableContext = {
  baseCurrency?: CurrencyCode
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
}

export interface TransactionRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'TRANSACTION'
  load: (
    transaction:
      | TransactionWithRiskDetails
      | AuxiliaryIndexTransaction
      | undefined,
    context?: RuleVariableContext
  ) => Promise<ReturnType>
  sourceField: keyof TransactionWithRiskDetails
}

export interface TransactionEventRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'TRANSACTION_EVENT'
  load: (
    transactionEvent: TransactionEvent | undefined,
    context?: RuleVariableContext
  ) => Promise<ReturnType>
}

export interface ConsumerUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'CONSUMER_USER'
  load: (user: User, context?: RuleVariableContext) => Promise<ReturnType>
}

export interface BusinessUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'BUSINESS_USER'
  load: (user: Business, context?: RuleVariableContext) => Promise<ReturnType>
}

export interface CommonUserRuleVariable<ReturnType = unknown>
  extends RuleVariableBase {
  entity: 'USER'
  load: (
    user: User | Business,
    context?: RuleVariableContext
  ) => Promise<ReturnType>
}
