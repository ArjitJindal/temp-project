import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { UserEvent, UserEventTypeEnum } from '@/@types/openapi-public/UserEvent'
import { paginateQuery } from '@/utils/dynamodb'
import { HitRulesResult } from '@/@types/openapi-public/HitRulesResult'

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

  public async saveUserEvent(
    userEvent: UserEvent,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      hitRules?: HitRulesResult[]
    } = {}
  ): Promise<string> {
    const eventId = userEvent.eventId || uuidv4()

    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.USER_EVENT(
                    this.tenantId,
                    userEvent.type,
                    userEvent.userId,
                    userEvent.timestamp
                  ),
                  eventId,
                  ...userEvent,
                  ...rulesResult,
                },
              },
            },
          ].filter(Boolean) as WriteRequest[],
        },
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    return eventId
  }

  public async getTypeUserEvents(
    userId: string,
    timeRange: TimeRange,
    eventType: UserEventTypeEnum
  ): Promise<ReadonlyArray<UserEvent>> {
    return this.getUserEvents(
      DynamoDbKeys.USER_EVENT(this.tenantId, eventType, userId).PartitionKeyID,
      timeRange
    )
  }

  private async getUserEvents(
    partitionKeyId: string,
    timeRange: TimeRange
  ): Promise<ReadonlyArray<UserEvent>> {
    const result = await paginateQuery(
      this.dynamoDb,
      this.getUserEventsQuery(partitionKeyId, timeRange)
    )
    return result.Items as unknown as ReadonlyArray<UserEvent>
  }

  private getUserEventsQuery(
    partitionKeyId: string,
    timeRange: TimeRange
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    const userEventAttributeNames = UserEvent.getAttributeTypeMap().map(
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
