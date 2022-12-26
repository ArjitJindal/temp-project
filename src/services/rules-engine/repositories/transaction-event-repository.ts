import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'

export class TransactionEventRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async saveTransactionEvent(
    transactionEvent: TransactionEvent,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      hitRules?: HitRulesDetails[]
    } = {}
  ): Promise<string> {
    const eventId = transactionEvent.eventId || uuidv4()

    const primaryKey = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionEvent.transactionId,
      transactionEvent.timestamp
    )
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...primaryKey,
                  eventId,
                  ...transactionEvent,
                  ...rulesResult,
                },
              },
            },
          ].filter(Boolean) as unknown as WriteRequest[],
        },
      }
    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))

    if (process.env.NODE_ENV === 'development') {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return eventId
  }
}
