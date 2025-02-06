import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Config, Operator } from '@react-awesome-query-builder/core'
import { JSONSchemaType } from 'ajv'
import { CustomBuiltInLogicOperatorKeyType } from './custom-built-in-operators'
import { LogicOperatorType } from '@/@types/openapi-internal/LogicOperatorType'

export type TextLogicOperator = LogicOperator<
  string | null | undefined,
  // string: for RHS as field; string[]: for RHS as value
  string[] | string | null | undefined
>
export type InternalCustomOperatorKeys =
  | CustomBuiltInLogicOperatorKeyType
  | 'op:hasItems'
  | 'op:equalArray'
export type LogicOperator<LHS = any, RHS = any> = {
  key: LogicOperatorType | InternalCustomOperatorKeys
  uiDefinition: Operator<Config>
  // NOTE: The order of the parameters is important. Same order will be used in the UI
  // and the same order will be used in the run function
  parameters?: Array<JSONSchemaType<any>>
  run: (
    lhs: LHS,
    rhs: RHS,
    parameters?: any,
    context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }
  ) => Promise<boolean>
}
