import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Config, Operator } from '@react-awesome-query-builder/core'
import { JSONSchemaType } from 'ajv'
import { AsyncLogicEngine } from 'json-logic-engine'
import { CustomBuiltInLogicOperatorKey } from './custom-built-in-operators'
import { LogicOperatorType } from '@/@types/openapi-internal/LogicOperatorType'

export type TextLogicOperator = LogicOperator<
  string | null | undefined,
  // string: for RHS as field; string[]: for RHS as value
  string[] | string | null | undefined
>
export type InternalCustomOperatorKeys =
  | CustomBuiltInLogicOperatorKey
  | 'op:hasItems'
  | 'op:equalArray'
  | 'op:internalLevenshteinDistance'
export type CustomOperator<LHS = any, RHS = any, Result = any> = {
  key: LogicOperatorType | InternalCustomOperatorKeys
  traverse?: boolean
  deterministic?: boolean
  uiDefinition: Operator<Config>
  // NOTE: The order of the parameters is important. Same order will be used in the UI
  // and the same order will be used in the run function
  parameters?: Array<JSONSchemaType<any>>
  run: (
    lhs: LHS,
    rhs: RHS,
    parameters?: any,
    context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient },
    internalContext?: { engine: AsyncLogicEngine; executionContext: object }
  ) => Promise<Result>
}

export type LogicOperator<LHS = any, RHS = any> = CustomOperator<
  LHS,
  RHS,
  boolean
>
