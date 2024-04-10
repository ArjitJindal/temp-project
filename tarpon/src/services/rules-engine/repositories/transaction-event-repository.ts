import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  BatchWriteCommand,
  BatchWriteCommandInput,
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Undefined } from '@/utils/lang'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { pickKnownEntityFields } from '@/utils/object'

@traceable
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
    rulesResult: Undefined<TransactionMonitoringResult> = {}
  ): Promise<string> {
    const eventId = transactionEvent.eventId || uuidv4()

    const primaryKey = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionEvent.transactionId,
      transactionEvent.timestamp
    )
    const batchWriteItemParams: BatchWriteCommandInput = {
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
        ].filter(Boolean),
      },
    }

    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))
    if (runLocalChangeHandler()) {
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

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :PartitionKeyID',
      ExpressionAttributeValues: {
        ':PartitionKeyID': PartitionKeyID,
      },
    }

    const { Items } = await this.dynamoDb.send(new QueryCommand(queryInput))

    return Items as TransactionEvent[]
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

  public async getMongoTransactionEvent(
    eventId: string
  ): Promise<TransactionEvent | null> {
    const db = this.mongoDb.db()
    const result = await db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .findOne({ eventId })

    if (!result) {
      return null
    }
    return pickKnownEntityFields(result, TransactionEvent)
  }
}
