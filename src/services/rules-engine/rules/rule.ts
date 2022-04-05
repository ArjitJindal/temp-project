import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'

export type RuleResult = {
  action: RuleAction
}

export class Rule<P> {
  tenantId: string
  transaction: Transaction
  parameters: P
  dynamoDb: AWS.DynamoDB.DocumentClient
  action: RuleAction

  constructor(
    tenantId: string,
    transaction: Transaction,
    parameters: P,
    action: RuleAction,
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    this.tenantId = tenantId
    this.transaction = transaction
    this.parameters = parameters
    this.dynamoDb = dynamoDb
    this.action = action
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error()
  }
}
