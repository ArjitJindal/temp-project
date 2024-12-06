import { FieldOrGroup } from '@react-awesome-query-builder/core'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { Feature } from '@/@types/openapi-internal/Feature'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import {
  AuxiliaryIndexTransaction,
  TransactionWithRiskDetails,
} from '@/services/rules-engine/repositories/transaction-repository-interface'

export type LogicValueTypesEnum =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
export type LogicEntityType =
  | 'TRANSACTION'
  | 'TRANSACTION_EVENT'
  | 'USER'
  | 'CONSUMER_USER'
  | 'BUSINESS_USER'
  | 'PAYMENT_DETAILS'

export interface LogicVariableBase {
  key: string
  entity: LogicEntityType
  uiDefinition: FieldOrGroup
  valueType: LogicValueTypesEnum
  sourceField?: string
  requiredFeatures?: Feature[]
  tenantIds?: string[]
  load: (...args: any[]) => Promise<any>
}

export type LogicVariableContext = {
  baseCurrency?: CurrencyCode
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
}

export interface TransactionLogicVariable<ReturnType = unknown>
  extends LogicVariableBase {
  entity: 'TRANSACTION'
  load: (
    transaction:
      | TransactionWithRiskDetails
      | AuxiliaryIndexTransaction
      | undefined,
    context?: LogicVariableContext
  ) => Promise<ReturnType>
  sourceField: keyof TransactionWithRiskDetails
}

export interface TransactionEventLogicVariable<ReturnType = unknown>
  extends LogicVariableBase {
  entity: 'TRANSACTION_EVENT'
  load: (
    transactionEvent: TransactionEvent | undefined,
    context?: LogicVariableContext
  ) => Promise<ReturnType>
}

export interface ConsumerUserLogicVariable<ReturnType = unknown>
  extends LogicVariableBase {
  entity: 'CONSUMER_USER'
  load: (user: User, context?: LogicVariableContext) => Promise<ReturnType>
}

export interface BusinessUserLogicVariable<ReturnType = unknown>
  extends LogicVariableBase {
  entity: 'BUSINESS_USER'
  load: (user: Business, context?: LogicVariableContext) => Promise<ReturnType>
}

export interface CommonUserLogicVariable<ReturnType = unknown>
  extends LogicVariableBase {
  entity: 'USER'
  load: (
    user: User | Business,
    context?: LogicVariableContext
  ) => Promise<ReturnType>
}
