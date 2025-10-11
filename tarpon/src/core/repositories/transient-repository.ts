import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { traceable } from '../xray'
import {
  batchGet,
  batchWrite,
  BatchWriteRequestInternal,
} from '@/utils/dynamodb'

const DEFAULT_TTL_SECONDS = 2592000 // 30 days
@traceable
export class TransientRepository<T = unknown> {
  dynamoDb: DynamoDBDocumentClient
  ttlSeconds?: number

  constructor(dynamoDb: DynamoDBDocumentClient, ttlSeconds?: number) {
    this.dynamoDb = dynamoDb
    this.ttlSeconds = ttlSeconds
  }

  public async hasPrimaryKeyId(primaryKeyId: string): Promise<boolean> {
    const result = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': primaryKeyId,
        },

        Limit: 1,
      })
    )
    return Boolean(result.Items?.length)
  }

  public async batchAddKey(
    keys: { partitionKeyId: string; sortKeyId: string }[]
  ) {
    await batchWrite(
      this.dynamoDb,
      keys.map(
        (key): BatchWriteRequestInternal => ({
          PutRequest: {
            Item: {
              PartitionKeyID: key.partitionKeyId,
              SortKeyID: key.sortKeyId,
              ttl: this.getUpdatedTTLAttribute(),
            },
          },
        })
      ),
      StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME
    )
  }

  public async addKey(partitionKeyId: string, sortKeyId: string) {
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Item: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
          ttl: this.getUpdatedTTLAttribute(),
        },
      })
    )
  }

  public async deleteKey(partitionKeyId: string, sortKeyId: string) {
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
        },
      })
    )
  }

  public async bulkCheckHasKey(
    partitionKeyId: string,
    sortKeyIds: string[]
  ): Promise<{ [key: string]: boolean }> {
    const data = await batchGet<{ PartitionKeyID: string; SortKeyID: string }>(
      this.dynamoDb,
      StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
      sortKeyIds.map((key) => ({
        PartitionKeyID: partitionKeyId,
        SortKeyID: key,
      }))
    )
    if (data) {
      return data.reduce((dict, curr) => {
        dict[curr.SortKeyID] = true
        return dict
      }, {})
    }
    return {}
  }

  public async hasKey(
    partitionKeyId: string,
    sortKeyId: string
  ): Promise<boolean> {
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
        },
      })
    )
    return Boolean(result.Item)
  }

  public async add(partitionKeyId: string, sortKeyId: string, item: T) {
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Item: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
          ...item,
          ttl: this.getUpdatedTTLAttribute(),
        },
      })
    )
  }

  public async get(
    partitionKeyId: string,
    sortKeyId: string
  ): Promise<T | undefined> {
    const result = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
        Key: {
          PartitionKeyID: partitionKeyId,
          SortKeyID: sortKeyId || 'default',
        },
      })
    )
    return result.Item as T
  }

  private getUpdatedTTLAttribute() {
    return (
      Math.floor(Date.now() / 1000) + (this.ttlSeconds || DEFAULT_TTL_SECONDS)
    )
  }
}
