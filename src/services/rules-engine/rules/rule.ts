import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RuleParameters } from '@/@types/rule/rule-instance'

export type RuleResult = {
  action: RuleAction
}

export class Rule<P extends RuleParameters = RuleParameters> {
  tenantId: string
  transaction: Transaction
  parameters: P
  dynamoDb: AWS.DynamoDB.DocumentClient

  constructor(
    tenantId: string,
    transaction: Transaction,
    parameters: P,
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    this.tenantId = tenantId
    this.transaction = transaction
    this.parameters = parameters
    this.dynamoDb = dynamoDb
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error()
  }
}
