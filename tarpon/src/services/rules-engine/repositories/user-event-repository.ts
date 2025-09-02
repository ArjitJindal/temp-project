import { v4 as uuidv4 } from 'uuid'
import { Filter, MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { paginateQuery, upsertSaveDynamo } from '@/utils/dynamodb'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { UserType } from '@/@types/user/user-type'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'
import { InternalUserEvent } from '@/@types/openapi-internal/InternalUserEvent'
import { DefaultApiGetEventsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { USER_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { pickKnownEntityFields } from '@/utils/object'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import { BusinessUserMonitoringResult } from '@/@types/openapi-public/BusinessUserMonitoringResult'
import { UserRulesResult } from '@/@types/openapi-public/UserRulesResult'
import { ConsumerUserEventWithRulesResult } from '@/@types/openapi-public/ConsumerUserEventWithRulesResult'
import { BusinessUserEventWithRulesResult } from '@/@types/openapi-public/BusinessUserEventWithRulesResult'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'

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
    userEvent: InternalConsumerUserEvent | InternalBusinessUserEvent,
    userType: UserType,
    rulesResult?: ConsumerUserMonitoringResult | BusinessUserMonitoringResult
  ): Promise<string> {
    if (this.tenantId.toLowerCase() === '0789ad73b8') {
      const consumerUserEvent = userEvent as ConsumerUserEvent
      if (consumerUserEvent.updatedConsumerUserAttributes?.linkedEntities) {
        ;(
          consumerUserEvent.updatedConsumerUserAttributes.linkedEntities as any
        ).childUserIds = undefined
      }
      const businessUserEvent = userEvent as BusinessUserEvent
      if (businessUserEvent.updatedBusinessUserAttributes?.linkedEntities) {
        ;(
          businessUserEvent.updatedBusinessUserAttributes.linkedEntities as any
        ).childUserIds = undefined
      }
    }

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

    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { eventId, ...userEvent, ...rulesResult },
        tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        key: primaryKey,
      },
      { versioned: true }
    )

    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
    }
    return eventId
  }

  public async updateUserEventWithRulesResult(
    userId: string,
    type: UserType,
    timestamp: number,
    rulesResult: UserRulesResult
  ): Promise<void> {
    const primaryKey =
      type === 'CONSUMER'
        ? DynamoDbKeys.CONSUMER_USER_EVENT(this.tenantId, userId, timestamp)
        : DynamoDbKeys.BUSINESS_USER_EVENT(this.tenantId, userId, timestamp)

    const updateCommand = new UpdateCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
      UpdateExpression:
        'SET #executedRules = :executedRules, #hitRules = :hitRules, #updateCount = if_not_exists(#updateCount, :zero) + :one',
      ExpressionAttributeNames: {
        '#executedRules': 'executedRules',
        '#hitRules': 'hitRules',
        '#updateCount': 'updateCount',
      },
      ExpressionAttributeValues: {
        ':executedRules': rulesResult.executedRules,
        ':hitRules': rulesResult.hitRules,
        ':zero': 0,
        ':one': 1,
      },
    })

    await this.dynamoDb.send(updateCommand)

    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
    }
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

  public async getMongoUserEventsByIds<
    T extends { eventId?: string } & (ConsumerUserEvent | BusinessUserEvent)
  >(eventIds: string[]): Promise<T[]> {
    const db = this.mongoDb.db()
    const result = await db
      .collection<T>(USER_EVENTS_COLLECTION(this.tenantId))
      .find({ eventId: { $in: eventIds } } as Filter<T>)
      .toArray()
    return result as T[]
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
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

  public async getUserEvent(
    type: UserType,
    userId: string,
    timestamp: number
  ): Promise<
    ConsumerUserEventWithRulesResult | BusinessUserEventWithRulesResult | null
  > {
    const primaryKey =
      type === 'CONSUMER'
        ? DynamoDbKeys.CONSUMER_USER_EVENT(this.tenantId, userId, timestamp)
        : DynamoDbKeys.BUSINESS_USER_EVENT(this.tenantId, userId, timestamp)

    const { Item } = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: primaryKey,
        ConsistentRead: true,
      })
    )

    if (!Item) {
      return null
    }

    return Item as ConsumerUserEvent | BusinessUserEvent
  }

  /**
   * Gets the latest user event timestamp for a specific user
   * @param userId - The user ID to get the latest user event timestamp for
   * @returns The timestamp of the latest user event, or null if no events exist
   */
  public async getLatestUserEventTimestampForUser(
    userId: string,
    userType: UserType
  ): Promise<number | null> {
    try {
      // Define the keys for both user types
      const consumerUserEventKey = DynamoDbKeys.CONSUMER_USER_EVENT(
        this.tenantId,
        userId
      )
      const businessUserEventKey = DynamoDbKeys.BUSINESS_USER_EVENT(
        this.tenantId,
        userId
      )

      // Query based on user type
      if (userType === 'CONSUMER') {
        // Query only consumer user events
        const consumerEvents = await paginateQuery(this.dynamoDb, {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          KeyConditionExpression: 'PartitionKeyID = :pk',
          ExpressionAttributeValues: {
            ':pk': consumerUserEventKey.PartitionKeyID,
          },
          ProjectionExpression: 'SortKeyID', // Only get timestamp
          ScanIndexForward: false, // Descending order
          Limit: 1,
        })

        const consumerLatest = consumerEvents.Items?.[0]?.SortKeyID
        if (!consumerLatest) {
          return null
        }

        return parseInt(consumerLatest)
      } else {
        // Query only business user events
        const businessEvents = await paginateQuery(this.dynamoDb, {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          KeyConditionExpression: 'PartitionKeyID = :pk',
          ExpressionAttributeValues: {
            ':pk': businessUserEventKey.PartitionKeyID,
          },
          ProjectionExpression: 'SortKeyID', // Only get timestamp
          ScanIndexForward: false, // Descending order
          Limit: 1,
        })

        const businessLatest = businessEvents.Items?.[0]?.SortKeyID
        if (!businessLatest) {
          return null
        }

        return parseInt(businessLatest)
      }
    } catch (error) {
      // Log error but don't fail
      console.error('Error fetching latest user event timestamp:', error)
      return null
    }
  }
}
