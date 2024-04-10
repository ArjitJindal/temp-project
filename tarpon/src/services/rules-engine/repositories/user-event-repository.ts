import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  BatchWriteCommand,
  BatchWriteCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { paginateQuery } from '@/utils/dynamodb'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { UserType } from '@/@types/user/user-type'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { InternalUserEvent } from '@/@types/openapi-internal/InternalUserEvent'
import { DefaultApiGetEventsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { USER_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { pickKnownEntityFields } from '@/utils/object'

@traceable
export class UserEventRepository {
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

  public async saveUserEvent(
    userEvent: ConsumerUserEvent | BusinessUserEvent,
    userType: UserType
  ): Promise<string> {
    const eventId = userEvent.eventId || uuidv4()
    let primaryKey
    if (userType == 'CONSUMER') {
      primaryKey = DynamoDbKeys.CONSUMER_USER_EVENT(
        this.tenantId,
        userEvent.userId,
        userEvent.timestamp
      )
    } else {
      primaryKey = DynamoDbKeys.BUSINESS_USER_EVENT(
        this.tenantId,
        userEvent.userId,
        userEvent.timestamp
      )
    }
    const batchWriteItemParams: BatchWriteCommandInput = {
      RequestItems: {
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: [
          {
            PutRequest: {
              Item: {
                ...primaryKey,
                eventId,
                ...userEvent,
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

  public async getMongoUserEvents(
    data: DefaultApiGetEventsListRequest
  ): Promise<Array<InternalUserEvent>> {
    const {
      userId,
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      sortField = 'timestamp',
      sortOrder = 'descend',
    } = data

    const userEventsCollectionName = USER_EVENTS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const userEventsCollection = db.collection<InternalUserEvent>(
      userEventsCollectionName
    )

    return userEventsCollection
      .find({ userId })
      .sort({ [sortField]: sortOrder === 'descend' ? -1 : 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
  }

  public async getMongoUserEvent(
    eventId: string
  ): Promise<ConsumerUserEvent | BusinessUserEvent | null> {
    const db = this.mongoDb.db()
    const result = await db
      .collection<InternalUserEvent>(USER_EVENTS_COLLECTION(this.tenantId))
      .findOne({ eventId })

    if (!result) {
      return null
    }
    const model = result.updatedConsumerUserAttributes
      ? ConsumerUserEvent
      : BusinessUserEvent
    return pickKnownEntityFields(result, model)
  }

  public async getUserEventsCount(userId: string): Promise<number> {
    const userEventsCollectionName = USER_EVENTS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const userEventsCollection = db.collection<InternalUserEvent>(
      userEventsCollectionName
    )

    return userEventsCollection.countDocuments({ userId })
  }

  public async getConsumerUserEvents(
    userId: string
  ): Promise<ReadonlyArray<ConsumerUserEvent>> {
    return this.getUserEventsByType(userId, 'CONSUMER')
  }

  public async getBusinessUserEvents(
    userId: string
  ): Promise<ReadonlyArray<BusinessUserEvent>> {
    return this.getUserEventsByType(userId, 'BUSINESS')
  }

  private async getUserEventsByType(
    userId: string,
    type: UserType
  ): Promise<ReadonlyArray<ConsumerUserEvent | BusinessUserEvent>> {
    const result = await paginateQuery(this.dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk':
          type === 'CONSUMER'
            ? DynamoDbKeys.CONSUMER_USER_EVENT(this.tenantId, userId)
                .PartitionKeyID
            : DynamoDbKeys.BUSINESS_USER_EVENT(this.tenantId, userId)
                .PartitionKeyID,
      },
      ScanIndexForward: false,
    })
    return result.Items as unknown as ReadonlyArray<
      ConsumerUserEvent | BusinessUserEvent
    >
  }
}
