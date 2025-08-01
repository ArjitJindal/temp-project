import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

@traceable
export class BatchRerunUsersRepository {
  private tenantId: string
  private dynamoDb: DynamoDBClient

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async createJobProgress(jobId: string) {
    const keys = DynamoDbKeys.BATCH_USERS_RERUN_PROGRESS(this.tenantId, jobId)
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...keys,
          sentCount: 0,
          processedCount: 0,
        },
      })
    )
  }

  private async incrementJobCount(
    jobId: string,
    incrementCount: number,
    countField: 'sentCount' | 'processedCount'
  ) {
    const keys = DynamoDbKeys.BATCH_USERS_RERUN_PROGRESS(this.tenantId, jobId)

    await this.dynamoDb.send(
      new UpdateCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: keys,
        UpdateExpression: `SET #count = if_not_exists(#count, :zero) + :increment`,
        ExpressionAttributeNames: {
          '#count': countField,
        },
        ExpressionAttributeValues: {
          ':increment': incrementCount,
          ':zero': 0,
        },
      })
    )
  }

  async incrementJobSentCount(jobId: string, incrementCount: number) {
    await this.incrementJobCount(jobId, incrementCount, 'sentCount')
  }

  async incrementJobProcessedCount(jobId: string, incrementCount: number) {
    await this.incrementJobCount(jobId, incrementCount, 'processedCount')
  }

  async getJobProgress(
    jobId: string
  ): Promise<{ sentCount: number; processedCount: number } | null> {
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.BATCH_USERS_RERUN_PROGRESS(this.tenantId, jobId),
      })
    )
    if (!result.Item) {
      return null
    }

    return {
      sentCount: (result.Item?.sentCount as number) ?? 0,
      processedCount: (result.Item?.processedCount as number) ?? 0,
    }
  }
}
