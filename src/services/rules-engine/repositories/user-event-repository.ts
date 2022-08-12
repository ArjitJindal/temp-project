import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { paginateQuery } from '@/utils/dynamodb'

type TimeRange = {
  beforeTimestamp: number
  afterTimestamp: number
}

export class UserEventRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async saveUserEvent(userEvent: ConsumerUserEvent): Promise<string> {
    const eventId = userEvent.eventId || uuidv4()
    const primaryKey = DynamoDbKeys.CONSUMER_USER_EVENT(
      this.tenantId,
      userEvent.userId,
      userEvent.timestamp
    )
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
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
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()

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
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND SortKeyID BETWEEN :skfrom AND :skto',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':skfrom': `${timeRange.afterTimestamp}`,
        ':skto': `${timeRange.beforeTimestamp}`,
      },
      ProjectionExpression: userEventAttributeNames
        .map((name) => `#${name}`)
        .join(', '),
      ExpressionAttributeNames: Object.fromEntries(
        userEventAttributeNames.map((name) => [`#${name}`, name])
      ),
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL',
    }
  }
}
