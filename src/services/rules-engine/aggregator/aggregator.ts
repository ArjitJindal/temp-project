import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AggregationRepository } from '../repositories/aggregation-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'

export abstract class Aggregator {
  tenantId: string
  transaction: Transaction
  aggregationRepository: AggregationRepository

  constructor(
    tenantId: string,
    transaction: Transaction,
    dynamoDb: DynamoDBDocumentClient
  ) {
    this.tenantId = tenantId
    this.transaction = transaction
    this.aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
  }

  public abstract aggregate(): Promise<void>
  public abstract getTargetTransactionState(): TransactionState
}
