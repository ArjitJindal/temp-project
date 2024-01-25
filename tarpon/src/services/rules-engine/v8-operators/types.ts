import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Config, Operator } from '@react-awesome-query-builder/core'
import { RuleOperatorType } from '@/@types/openapi-internal/RuleOperatorType'

export type RuleOperator<LHS = any, RHS = any> = {
  key: RuleOperatorType
  uiDefinition: Operator<Config>
  run: (
    lhs: LHS,
    rhs: RHS,
    context: { tenantId: string; dynamoDb: DynamoDBDocumentClient }
  ) => Promise<boolean>
}
