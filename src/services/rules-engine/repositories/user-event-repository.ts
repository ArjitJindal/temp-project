import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { FailedRulesResult } from '@/@types/openapi-public/FailedRulesResult'
import { UserEvent, UserEventTypeEnum } from '@/@types/openapi-public/UserEvent'

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
      failedRules?: FailedRulesResult[]
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

  public async getAfterTimestampTypeUserEvents(
    userId: string,
    afterTimestamp: number,
    eventType: UserEventTypeEnum
  ): Promise<ReadonlyArray<UserEvent>> {
    return this.getAfterTimestampUserEvents(
      DynamoDbKeys.USER_EVENT(this.tenantId, eventType, userId).PartitionKeyID,
      afterTimestamp
    )
  }

  private async getAfterTimestampUserEvents(
    partitionKeyId: string,
    afterTimestamp: number
  ): Promise<ReadonlyArray<UserEvent>> {
    const result = await this.dynamoDb
      .query(
        this.getAfterTimestampUserEventsQuery(partitionKeyId, afterTimestamp)
      )
      .promise()
    return result.Items as unknown as ReadonlyArray<UserEvent>
  }

  private getAfterTimestampUserEventsQuery(
    partitionKeyId: string,
    timestamp: number
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    const userEventAttributeNames = UserEvent.getAttributeTypeMap().map(
      (attribute) => attribute.name
    )
    return {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID > :sk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':sk': `${timestamp}`,
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
