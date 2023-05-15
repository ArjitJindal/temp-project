import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { paginateQuery } from '@/utils/dynamodb'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { UserType } from '@/@types/user/user-type'

type TimeRange = {
  beforeTimestamp: number // exclusive
  afterTimestamp: number // inclusive
}

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
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
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
          ].filter(Boolean) as WriteRequest[],
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

  public async getTypeUserEvents(
    userId: string,
    timeRange: TimeRange
  ): Promise<ReadonlyArray<ConsumerUserEvent>> {
    return this.getUserEvents(
      DynamoDbKeys.CONSUMER_USER_EVENT(this.tenantId, userId).PartitionKeyID,
      timeRange
    )
  }

  private async getUserEvents(
    partitionKeyId: string,
    timeRange: TimeRange
  ): Promise<ReadonlyArray<ConsumerUserEvent>> {
    const result = await paginateQuery(
      this.dynamoDb,
      this.getUserEventsQuery(partitionKeyId, timeRange)
    )
    return result.Items as unknown as ReadonlyArray<ConsumerUserEvent>
  }

  private getUserEventsQuery(
    partitionKeyId: string,
    timeRange: TimeRange
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    const userEventAttributeNames = ConsumerUserEvent.getAttributeTypeMap().map(
      (attribute) => attribute.name
    )
    return {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND SortKeyID BETWEEN :skfrom AND :skto',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':skfrom': `${timeRange.afterTimestamp}`,
        ':skto': `${timeRange.beforeTimestamp - 1}`,
      },
      ProjectionExpression: userEventAttributeNames
        .map((name) => `#${name}`)
        .join(', '),
      ExpressionAttributeNames: Object.fromEntries(
        userEventAttributeNames.map((name) => [`#${name}`, name])
      ),
      ScanIndexForward: false,
    }
  }
}
