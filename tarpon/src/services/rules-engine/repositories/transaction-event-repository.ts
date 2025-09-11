import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
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
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { TransactionEventsResponse } from '@/@types/openapi-internal/TransactionEventsResponse'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { TransactionsEventResponse } from '@/@types/openapi-internal/TransactionsEventResponse'
import { GeoIPService } from '@/services/geo-ip'
import { hydrateIpInfo } from '@/services/rules-engine/utils/geo-utils'
import {
  getUpsertSaveDynamoCommand,
  paginateQuery,
  transactWrite,
} from '@/utils/dynamodb'

@traceable
export class TransactionEventRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string
  private geoService: GeoIPService

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
    this.geoService = new GeoIPService(tenantId, this.dynamoDb)
  }

  public async saveTransactionEvent(
    transactionEvent: InternalTransactionEvent,
    rulesResult: Undefined<TransactionMonitoringResult> = {}
  ): Promise<string> {
    const eventIds = await this.saveTransactionEvents([
      { transactionEvent, rulesResult },
    ])
    return eventIds[0]
  }

  public async saveTransactionEvents(
    transactionEvents: Array<{
      transactionEvent: InternalTransactionEvent
      rulesResult?: Undefined<TransactionMonitoringResult>
    }>
  ): Promise<string[]> {
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    const primaryKeys: {
      PartitionKeyID: string
      SortKeyID: string | undefined
    }[] = []

    // Process each event and prepare write requests
    const operations = await Promise.all(
      transactionEvents.map(async (e) => {
        const eventId = e.transactionEvent.eventId || uuidv4()

        await hydrateIpInfo(
          this.geoService,
          e.transactionEvent.updatedTransactionAttributes
        )

        const primaryKey = DynamoDbKeys.TRANSACTION_EVENT(
          this.tenantId,
          e.transactionEvent.transactionId,
          {
            timestamp: e.transactionEvent.timestamp,
            eventId,
          }
        )
        primaryKeys.push(primaryKey)
        return {
          Update: getUpsertSaveDynamoCommand(
            {
              entity: { eventId, ...e.transactionEvent, ...e.rulesResult },
              tableName: tableName,
              key: primaryKey,
            },
            { versioned: true }
          ),
          eventId: eventId,
        }
      })
    )

    // Batch write all items in a single db operation
    await transactWrite(
      this.dynamoDb,
      operations.map((operation) => ({ Update: operation.Update }))
    )

    // Handle local changes if needed
    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await Promise.all(
        primaryKeys
          .filter((primaryKey) => primaryKey !== undefined)
          .map((primaryKey) =>
            localTarponChangeCaptureHandler(this.tenantId, primaryKey)
          )
      )
    }
    return operations.map((request) => request.eventId)
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
      'SET executedRules = :executedRules, hitRules = :hitRules, #status = :status, #updateCount = if_not_exists(#updateCount, :zero) + :one'
    const updateValues = {
      ':executedRules': rulesResult.executedRules,
      ':hitRules': rulesResult.hitRules,
      ':status': rulesResult.status,
      ':one': 1,
      ':zero': 0,
    }
    const updateParams: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: updateValues,
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updateCount': 'updateCount',
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
    transactionId: string
  ): Promise<TransactionEventWithRulesResult[]> {
    const PartitionKeyID = DynamoDbKeys.TRANSACTION_EVENT(
      this.tenantId,
      transactionId
    ).PartitionKeyID
    const query = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :PartitionKeyID',
      ExpressionAttributeValues: {
        ':PartitionKeyID': PartitionKeyID,
      },
      ConsistentRead: true,
    }
    const { Items } = await paginateQuery(this.dynamoDb, query)
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

  public async getMongoTransactionEventsForTransaction(
    transactionId: string,
    options?: {
      pageSize?: number
      page?: number
    }
  ): Promise<TransactionEventsResponse> {
    const db = this.mongoDb.db()
    const transactionEventCollection = db.collection<TransactionEvent>(
      TRANSACTION_EVENTS_COLLECTION(this.tenantId)
    )

    const cursor = transactionEventCollection.find({ transactionId })

    if (options?.pageSize) {
      cursor.limit(options.pageSize)
    }

    if (options?.page) {
      cursor.skip((options.page - 1) * (options.pageSize || DEFAULT_PAGE_SIZE))
    }

    const [total, events] = await Promise.all([
      transactionEventCollection.countDocuments({
        transactionId,
      }),
      cursor.toArray(),
    ])

    return {
      items: pickKnownEntityFields(events, InternalTransactionEvent),
      total: total,
    }
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

  public async getMongoTransactionEventsByIds(
    eventIds: string[]
  ): Promise<TransactionEvent[]> {
    const db = this.mongoDb.db()
    const events = db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .find({ eventId: { $in: eventIds } })
      .toArray()

    return events
  }

  public async getTransactionEventsPaginatedMongo(
    transactionId: string,
    params: { page: number; pageSize: number }
  ): Promise<TransactionsEventResponse> {
    const db = this.mongoDb.db()
    const eventsPromise = db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .find({ transactionId })
      .sort({ timestamp: -1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)

    const countPromise = db
      .collection<TransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(this.tenantId)
      )
      .countDocuments({ transactionId })

    const [events, count] = await Promise.all([
      eventsPromise.toArray(),
      countPromise,
    ])

    return {
      items: events,
      count,
    }
  }
}
