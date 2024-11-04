import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Undefined } from '@/utils/lang'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { pickKnownEntityFields } from '@/utils/object'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'

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
      {
        timestamp: transactionEvent.timestamp,
        eventId,
      }
    )
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...primaryKey,
          eventId,
          ...transactionEvent,
          ...rulesResult,
        },
      })
    )
    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
    }
    return eventId
  }

  public async updateTransactionEventRulesResult(
    transactionId: string,
    event: TransactionEvent,
    rulesResult: Undefined<TransactionMonitoringResult> = {}
  ): Promise<void> {
    // just update the rules result
    const key = DynamoDbKeys.TRANSACTION_EVENT(this.tenantId, transactionId, {
      timestamp: event.timestamp,
      eventId: event.eventId as string,
    })
    const updateExpression =
      'SET executedRules = :executedRules, hitRules = :hitRules, #status = :status'
    const updateValues = {
      ':executedRules': rulesResult.executedRules,
      ':hitRules': rulesResult.hitRules,
      ':status': rulesResult.status,
    }
    const updateParams: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: updateValues,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    }
    await this.dynamoDb.send(new UpdateCommand(updateParams))
    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, key)
    }
  }

  public async getTransactionEvents(
    transactionId: string,
    options?: { consistentRead?: boolean }
  ): Promise<TransactionEventWithRulesResult[]> {
    const PartitionKeyID = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionId
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :PartitionKeyID',
      ExpressionAttributeValues: {
        ':PartitionKeyID': PartitionKeyID,
      },
      ...(options?.consistentRead && { ConsistentRead: true }),
    }

    const { Items } = await this.dynamoDb.send(new QueryCommand(queryInput))

    return Items as TransactionEventWithRulesResult[]
  }

  public async getLastTransactionEvent(
    transactionId: string
  ): Promise<TransactionEvent | null> {
    const PartitionKeyID = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionId
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :PartitionKeyID',
      ExpressionAttributeValues: {
        ':PartitionKeyID': PartitionKeyID,
      },
      ScanIndexForward: false,
      Limit: 1,
    }
    const { Items } = await this.dynamoDb.send(new QueryCommand(queryInput))
    return Items?.[0] ? (Items[0] as TransactionEvent) : null
  }

  public async getMongoLastTransactionEvent(
    transactionId: string
  ): Promise<TransactionEvent | null> {
    const db = this.mongoDb.db()
    const result = await db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .find({ transactionId })
      .sort({ timestamp: -1 })
      .limit(1)
      .next()

    if (!result) {
      return null
    }
    return pickKnownEntityFields(result, TransactionEvent)
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
