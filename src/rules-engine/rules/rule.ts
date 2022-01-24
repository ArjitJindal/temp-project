import { Transaction } from '../../@types/transaction/transaction'

export enum RuleActionEnum {
  ALLOW = 'ALLOW',
  FLAG = 'FLAG',
  BLOCK = 'BLOCK',
}
export type RuleParameters = {
  action: RuleActionEnum
}

export type RuleInfo = {
  name: string
  displayName: string
  description: string
  parameters?: RuleParameters
}

export type RuleResult = {
  action: RuleActionEnum
}

export abstract class Rule<P extends RuleParameters = RuleParameters> {
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

  abstract getInfo(): RuleInfo

  abstract computeRule(): Promise<RuleResult | undefined>
}
