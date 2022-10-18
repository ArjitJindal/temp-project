import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleFilter } from '../filter'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export class UserRuleFilter<P> extends RuleFilter {
  tenantId: string
  senderUser?: User | Business
  receiverUser?: User | Business
  parameters: P
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    parameters: P,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.senderUser = data.senderUser
    this.receiverUser = data.receiverUser
    this.parameters = parameters
    this.dynamoDb = dynamoDb
  }
}
