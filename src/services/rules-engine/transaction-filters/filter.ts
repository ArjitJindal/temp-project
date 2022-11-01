import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleFilter } from '../filter'
import { Transaction } from '@/@types/openapi-public/Transaction'

export class TransactionRuleFilter<P> extends RuleFilter {
  tenantId: string
  transaction: Transaction
  parameters: P
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
    },
    parameters: P,
    dynamoDb: DynamoDBDocumentClient
  ) {
    super()
    this.tenantId = tenantId
    this.transaction = data.transaction
    this.parameters = parameters
    this.dynamoDb = dynamoDb
  }
}
