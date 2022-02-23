import { Transaction } from '../../../@types/openapi-public/transaction'
import {
  RuleActionEnum,
  RuleParameters,
} from '../../../@types/rule/rule-instance'

export type RuleInfo = {
  name: string
  displayName: string
  description: string
  parameters?: RuleParameters
}

export type RuleResult = {
  action: RuleActionEnum
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

  public getInfo(): RuleInfo {
    throw new Error()
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error()
  }
}
