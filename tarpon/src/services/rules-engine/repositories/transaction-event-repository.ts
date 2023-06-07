import { v4 as uuidv4 } from 'uuid'
import { Filter, MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongoDBUtils'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'

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
                  createdAt: Date.now(),
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

  public async getTransactionEvents(
    transactionId: string
  ): Promise<TransactionEvent[]> {
    const PartitionKeyID = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionId
    ).PartitionKeyID

    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :PartitionKeyID',
      ExpressionAttributeValues: {
        ':PartitionKeyID': PartitionKeyID,
      },
    }

    const { Items } = await this.dynamoDb.send(new QueryCommand(queryInput))

    return Items as TransactionEvent[]
  }

  public async getTransactionEventCount(
    query: Filter<InternalTransactionEvent>
  ): Promise<number> {
    const db = this.mongoDb.db()
    const transactionEventCollection = db.collection<InternalTransactionEvent>(
      TRANSACTION_EVENTS_COLLECTION(this.tenantId)
    )

    return await transactionEventCollection.countDocuments(query)
  }

  public async getMongoTransactionEvents(
    transactionIds: string[]
  ): Promise<Map<string, TransactionEvent[]>> {
    const db = this.mongoDb.db()
    const transactionEventCollection = await db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .find({ transactionId: { $in: transactionIds } })

    const events = new Map<string, TransactionEvent[]>()
    await transactionEventCollection.forEach((event) => {
      events.set(
        event.transactionId,
        (events.get(event.transactionId) ?? []).concat(event)
      )
    })
    return events
  }
}
