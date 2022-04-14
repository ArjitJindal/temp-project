import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'

export type RuleResult = {
  action: RuleAction
}

export type RuleFilter = () => Promise<boolean> | boolean

export class Rule<P> {
  tenantId: string
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  parameters: P
  action: RuleAction
  dynamoDb: AWS.DynamoDB.DocumentClient

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    params: {
      parameters: P
      action: RuleAction
    },
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.senderUser = data.senderUser
    this.receiverUser = data.receiverUser
    this.parameters = params.parameters
    this.action = params.action
    this.dynamoDb = dynamoDb
  }

  /**
   * TODO: For now, the filtered are hard-coded in each rule. We could
   * have a 'filters' library and users can apply arbitrary filters to
   * a rule.
   */
  public getFilters(): RuleFilter[] {
    return []
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error()
  }
}
