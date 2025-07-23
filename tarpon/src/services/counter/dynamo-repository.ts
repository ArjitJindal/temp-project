import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

import { StackConstants } from '@lib/constants'
import {
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { COUNTER_ENTITIES, CounterEntity } from './repository'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { DynamoTransactionBatch } from '@/utils/dynamodb'

@traceable
export class DynamoCounterRepository {
  private tenantId: string
  private dynamoDb: DynamoDBClient
  private tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async initialize(): Promise<void> {
    for (const entity of COUNTER_ENTITIES) {
      const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
      const commandInput: GetCommandInput = {
        TableName: this.tableName,
        Key: key,
        ConsistentRead: true,
      }
      const command = new GetCommand(commandInput)
      const commandResult = await this.dynamoDb.send(command)
      if (!commandResult.Item) {
        const writeRequest = {
          TableName: this.tableName,
          Item: {
            ...key,
            count: 0,
          },
        }
        await this.dynamoDb.send(new PutCommand(writeRequest))
      }
    }
  }
  public async getNextCounterAndUpdate(entity: CounterEntity): Promise<number> {
    const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
    const commandInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'ADD #count :increment',
      ExpressionAttributeNames: {
        '#count': 'count',
      },
      ExpressionAttributeValues: {
        ':increment': 1,
      },
      ReturnValues: 'UPDATED_NEW',
    }
    const command = new UpdateCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)
    return commandResult.Attributes?.count ?? 1
  }

  public async getNextCounter(entity: CounterEntity): Promise<number> {
    const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
    const commandInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
      ConsistentRead: true,
    }
    const command = new GetCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)
    return (commandResult.Item?.count ?? 0) + 1
  }
  public async getNextCountersAndUpdate(
    entity: CounterEntity,
    count: number
  ): Promise<number[]> {
    const value = (await this.getNextCounterAndUpdate(entity)) ?? 1
    return [...new Array(count)].map((_, i) => value - i)
  }

  public async setCounterValue(
    entity: CounterEntity,
    count: number
  ): Promise<void> {
    const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
    const commandInput: PutCommandInput = {
      TableName: this.tableName,
      Item: {
        ...key,
        count,
      },
    }
    const command = new PutCommand(commandInput)
    await this.dynamoDb.send(command)
  }

  public async setCounters(
    counters: { entity: CounterEntity; count: number }[]
  ) {
    // Create document client and batch for operations
    const docClient = DynamoDBDocumentClient.from(this.dynamoDb)
    const batch = new DynamoTransactionBatch(docClient, this.tableName)

    for (const counter of counters) {
      const key = DynamoDbKeys.COUNTER(this.tenantId, counter.entity)

      batch.put({
        Item: {
          ...key,
          count: counter.count,
        },
      })
    }

    await batch.execute()
  }
}
