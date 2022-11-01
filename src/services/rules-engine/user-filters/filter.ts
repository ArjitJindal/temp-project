import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleFilter } from '../filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export class UserRuleFilter<P> extends RuleFilter {
  tenantId: string
  user: User | Business
  parameters: P
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      user: User | Business
    },
    parameters: P,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.parameters = parameters
    this.dynamoDb = dynamoDb
  }
}
