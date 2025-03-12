import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export abstract class Aggregator {
  tenantId: string
  aggregationRepository: AggregationRepository
  dynamoDb: DynamoDBDocumentClient
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
  }

  public abstract aggregate(transaction: Transaction): Promise<void>
  public abstract getTargetTransactionState(): TransactionState
  public abstract rebuildAggregation(
    userId: string,
    options?: { now: number }
  ): Promise<any>
}
