import { Transaction } from '../../@types/openapi-public/transaction'
import { AggregationRepository } from '../repositories/aggregation-repository'

export abstract class Aggregator {
  tenantId: string
  transaction: Transaction
  aggregationRepository: AggregationRepository

  constructor(
    tenantId: string,
    transaction: Transaction,
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    this.tenantId = tenantId
    this.transaction = transaction
    this.aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
  }

  public abstract aggregate(): Promise<void>
}
