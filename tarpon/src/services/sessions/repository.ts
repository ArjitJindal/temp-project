import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export type ActiveSession = {
  PartitionKeyID: string
  SortKeyID: string
  userId: string
  userAgent: string
  deviceFingerprint: string
  createdAt: number
}

export class SessionsRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    const result = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.ACTIVE_SESSIONS(this.tenantId, userId)
            .PartitionKeyID,
        },
      })
    )

    return (result.Items ?? []) as ActiveSession[]
  }

  public async getActiveSession(
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<ActiveSession | null> {
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.ACTIVE_SESSIONS(this.tenantId, userId, deviceInfo),
      })
    )

    return result.Item as ActiveSession | null
  }

  public async createActiveSession(
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<void> {
    const keys = DynamoDbKeys.ACTIVE_SESSIONS(this.tenantId, userId, deviceInfo)

    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Item: {
          ...keys,
          userId,
          ...deviceInfo,
          createdAt: Date.now(),
        },
      })
    )
  }

  public async deleteActiveSession(session: ActiveSession): Promise<void> {
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: session.PartitionKeyID,
          SortKeyID: session.SortKeyID,
        },
      })
    )
  }
}
