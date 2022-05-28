import { AggregationRepository } from '../repositories/aggregation-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'

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

  public abstract shouldAggregate(): boolean

  public abstract aggregate(): Promise<void>
}
