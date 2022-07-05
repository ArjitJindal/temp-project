import { Rule } from '../rule'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

export type RuleResult = {
  action: RuleAction
}

export type DefaultTransactionRuleParameters = {
  transactionState?: TransactionState
}

export class TransactionRule<P> extends Rule {
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
    super()
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.senderUser = data.senderUser
    this.receiverUser = data.receiverUser
    this.parameters = params.parameters
    this.action = params.action
    this.dynamoDb = dynamoDb
  }

  public getFilters() {
    const parameters = this.parameters as DefaultTransactionRuleParameters
    return [
      () =>
        !parameters.transactionState ||
        this.transaction.transactionState === parameters.transactionState,
    ]
  }
}
