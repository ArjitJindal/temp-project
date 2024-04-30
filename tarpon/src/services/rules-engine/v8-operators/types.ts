import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Config, Operator } from '@react-awesome-query-builder/core'
import { JSONSchemaType } from 'ajv'
import { RuleOperatorType } from '@/@types/openapi-internal/RuleOperatorType'

export type TextRuleOperator = RuleOperator<
  string | null | undefined,
  // string: for RHS as field; string[]: for RHS as value
  string[] | string | null | undefined
>

export type RuleOperator<LHS = any, RHS = any> = {
  key: RuleOperatorType
  uiDefinition: Operator<Config>
  // NOTE: The order of the parameters is important. Same order will be used in the UI
  // and the same order will be used in the run function
  parameters?: Array<JSONSchemaType<any>>
  run: (
    lhs: LHS,
    rhs: RHS,
    parameters?: any[],
    context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }
  ) => Promise<boolean>
}
