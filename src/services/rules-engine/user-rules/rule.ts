import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Rule } from '../rule'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'

export type RuleResult = {
  action: RuleAction
}

export type RuleFilter = () => Promise<boolean> | boolean

export class UserRule<P> extends Rule {
  tenantId: string
  user: User | Business
  userEvent: ConsumerUserEvent | undefined
  parameters: P
  action: RuleAction
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      user: User | Business
      userEvent?: ConsumerUserEvent
    },
    params: {
      parameters: P
      action: RuleAction
    },
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.userEvent = data.userEvent
    this.parameters = params.parameters
    this.action = params.action
    this.dynamoDb = dynamoDb
  }
}
