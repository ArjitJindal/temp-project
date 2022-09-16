import { StackConstants } from '@cdk/constants'

const DEFAULT_TTL_SECONDS = 2592000 // 30 days

export class TransientRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  ttlSeconds?: number

  constructor(dynamoDb: AWS.DynamoDB.DocumentClient, ttlSeconds?: number) {
    this.dynamoDb = dynamoDb
    this.ttlSeconds = ttlSeconds
  }

  public async hasPrimaryKeyId(primaryKeyId: string): Promise<boolean> {
    const result = await this.dynamoDb
      .query({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': primaryKeyId,
        },
        ReturnConsumedCapacity: 'TOTAL',
        Limit: 1,
      })
      .promise()
    return Boolean(result.Items?.length)
  }

  public async addKey(partitionKeyId: string, sortKeyId: string) {
    await this.dynamoDb
      .put({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Item: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
          ttl: this.getUpdatedTTLAttribute(),
        },
        ReturnConsumedCapacity: 'TOTAL',
      })
      .promise()
  }

  public async deleteKey(partitionKeyId: string, sortKeyId: string) {
    await this.dynamoDb
      .delete({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
        },
        ReturnConsumedCapacity: 'TOTAL',
      })
      .promise()
  }

  public async hasKey(
    partitionKeyId: string,
    sortKeyId: string
  ): Promise<boolean> {
    const result = await this.dynamoDb
      .get({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
        },
        ReturnConsumedCapacity: 'TOTAL',
      })
      .promise()
    return Boolean(result.Item)
  }

  private getUpdatedTTLAttribute() {
    return (
      Math.floor(Date.now() / 1000) + (this.ttlSeconds || DEFAULT_TTL_SECONDS)
    )
  }
}
